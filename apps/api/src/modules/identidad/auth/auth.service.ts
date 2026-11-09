import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  SessionRevocationReason,
  UserStatus,
  type CurrentUserProfile,
  type SessionProvider,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import type { Env } from '../../../core/config/env.validation';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/database/transaction-runner';
import { CredentialsService } from '../credentials/credentials.service';
import { UsersService } from '../users/users.service';
import { AUTH_PROVIDERS, type AuthProvider } from './providers/auth-provider';
import { RefreshTokenCodec } from './refresh-token.codec';
import type { SessionRecord, SessionWithOwner } from './session.repository';
import { SessionsService } from './sessions.service';

export const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos';

const ACCESS_TOKEN_TYPE = 'access';
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

/** Tokens de una sesión, listos para ir en cookies. */
export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  /** Máximo absoluto de la sesión («mantener la sesión iniciada»); nulo si no lo tiene. */
  expiresAt: Date | null;
}

export interface SessionResult {
  issued: IssuedSession;
  user: CurrentUserProfile;
}

interface AccessTokenPayload {
  sub?: unknown;
  sid?: unknown;
  typ?: unknown;
}

/**
 * Emite, renueva y valida sesiones. Es independiente del proveedor que autenticó al
 * usuario: solo `signIn` toca un `AuthProvider`.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTokens: RefreshTokenCodec;
  private readonly graceMs: number;
  private readonly accessTtlSeconds: number;

  constructor(
    @Inject(AUTH_PROVIDERS) private readonly providers: AuthProvider[],
    private readonly users: UsersService,
    private readonly credentials: CredentialsService,
    private readonly sessions: SessionsService,
    private readonly jwt: JwtService,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
    config: ConfigService<Env, true>,
  ) {
    this.refreshTokens = new RefreshTokenCodec(config.get('REFRESH_TOKEN_SECRET', { infer: true }));
    this.graceMs = config.get('REFRESH_ROTATION_GRACE_SECONDS', { infer: true }) * MS_PER_SECOND;
    this.accessTtlSeconds =
      config.get('ACCESS_TOKEN_TTL_MINUTES', { infer: true }) * SECONDS_PER_MINUTE;
  }

  /** Ingreso con el proveedor indicado. Cualquier fallo es el mismo 401. */
  async signIn(
    providerName: SessionProvider,
    input: unknown,
    rememberMe: boolean,
  ): Promise<SessionResult> {
    const provider = this.providers.find((candidate) => candidate.name === providerName);
    if (!provider) {
      throw new Error(`Proveedor de autenticación no registrado: ${providerName}`);
    }
    const identity = await provider.authenticate(input);
    const user = identity ? await this.users.find(identity.userId) : null;
    if (user?.status !== UserStatus.Active) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    const session = await this.sessions.create(user.id, provider.name, rememberMe, new Date());
    return { issued: await this.issue(session, session.generation), user: toProfile(user) };
  }

  /**
   * Renueva la sesión con el token de renovación. Devuelve `null` si no es válido (el
   * controlador responde 401 y borra las cookies). No lanza ni abre transacción: la
   * revocación por reutilización debe confirmarse aunque la petición termine en 401.
   */
  async refresh(token: string | undefined): Promise<SessionResult | null> {
    const claims = this.refreshTokens.parse(token);
    if (!claims) {
      return null;
    }
    // Dos pasadas como máximo: la segunda solo ocurre si otra petición rotó a la vez.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const found = await this.sessions.find(claims.sessionId);
      const now = new Date();
      if (
        !found ||
        !this.sessions.isValid(found, now) ||
        claims.generation > found.session.generation
      ) {
        return null;
      }
      const { session } = found;

      if (claims.generation === session.generation) {
        if (await this.sessions.rotate(session, now)) {
          return this.refreshed(session, session.generation + 1);
        }
        continue;
      }
      if (this.withinGrace(session, claims.generation, now)) {
        // Otra pestaña acaba de rotar: se devuelve el token vigente sin rotar de nuevo.
        return this.refreshed(session, session.generation);
      }
      await this.revokeForReuse(found);
      return null;
    }
    return null;
  }

  /** Revoca la sesión del token de renovación y la de la petición; no falla si ya no eran válidas. */
  async logout(refreshToken: string | undefined, sessionId: string | undefined): Promise<void> {
    const ids = new Set<string>();
    const claims = this.refreshTokens.parse(refreshToken);
    if (claims) {
      ids.add(claims.sessionId);
    }
    if (sessionId) {
      ids.add(sessionId);
    }
    if (ids.size > 0) {
      await this.sessions.revoke([...ids], SessionRevocationReason.Logout);
    }
  }

  /**
   * Identifica al usuario de un token de acceso. El rol sale de la base de datos, no del
   * token: un cambio de rol, una desactivación o una revocación surten efecto en la
   * siguiente petición. `null` si el token o la sesión no son válidos.
   */
  async authenticate(accessToken: string): Promise<RequestUser | null> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(accessToken, {
        algorithms: ['HS256'],
      });
    } catch {
      return null;
    }
    if (
      payload.typ !== ACCESS_TOKEN_TYPE ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string'
    ) {
      return null;
    }
    const found = await this.sessions.find(payload.sid);
    if (!found || found.user.id !== payload.sub || !this.sessions.isValid(found, new Date())) {
      return null;
    }
    return { id: found.user.id, role: found.user.role, sessionId: found.session.id };
  }

  async profile(userId: string): Promise<CurrentUserProfile> {
    const user = await this.users.find(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return toProfile(user);
  }

  /** Cambia la contraseña propia: exige la actual y cierra las demás sesiones. */
  async changePassword(
    actor: RequestUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (!(await this.credentials.verify(actor.id, currentPassword))) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }
    await this.transactions.run(async () => {
      await this.credentials.assign(actor.id, newPassword);
      await this.sessions.revokeAllForUser(
        actor.id,
        SessionRevocationReason.PasswordChange,
        actor.sessionId,
      );
    });
  }

  private withinGrace(session: SessionRecord, generation: number, now: Date): boolean {
    return (
      generation === session.generation - 1 &&
      session.rotatedAt !== null &&
      now.getTime() <= session.rotatedAt.getTime() + this.graceMs
    );
  }

  private async revokeForReuse({ session }: SessionWithOwner): Promise<void> {
    await this.sessions.revokeAllForUser(session.userId, SessionRevocationReason.TokenReuse);
    // Solo identificadores: nunca el token.
    this.logger.warn({
      msg: 'Reutilización de un token de renovación: sesiones revocadas',
      userId: session.userId,
      sessionId: session.id,
    });
  }

  private async refreshed(session: SessionRecord, generation: number): Promise<SessionResult> {
    const user = await this.users.find(session.userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { issued: await this.issue(session, generation), user: toProfile(user) };
  }

  private async issue(session: SessionRecord, generation: number): Promise<IssuedSession> {
    const accessToken = await this.jwt.signAsync(
      { sub: session.userId, sid: session.id, typ: ACCESS_TOKEN_TYPE },
      { expiresIn: this.accessTtlSeconds },
    );
    return {
      accessToken,
      refreshToken: this.refreshTokens.sign(session.id, generation),
      expiresAt: session.expiresAt,
    };
  }
}

function toProfile(user: CurrentUserProfile & { status?: unknown }): CurrentUserProfile {
  return { id: user.id, fullName: user.fullName, email: user.email, role: user.role };
}
