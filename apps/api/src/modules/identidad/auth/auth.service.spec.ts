import { randomUUID } from 'node:crypto';
import { Logger, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  SessionProvider,
  SessionRevocationReason,
  UserRole,
  UserStatus,
  type User,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import type { TransactionRunner } from '../../../shared/database/transaction-runner';
import type { AuditEntry, AuditLogService } from '../../auditoria/audit-log.service';
import type { CredentialsService } from '../credentials/credentials.service';
import type { UsersService } from '../users/users.service';
import { AuthService, INVALID_CREDENTIALS_MESSAGE } from './auth.service';
import type { AuthAttempt, AuthProvider } from './providers/auth-provider';
import type {
  NewSession,
  SessionOwner,
  SessionRecord,
  SessionRepository,
  SessionWithOwner,
} from './session.repository';
import { SessionsService } from './sessions.service';

const HOUR = 3_600_000;
const START = new Date('2026-01-05T08:00:00.000Z');

// Solo se falsea `Date`: argon2 y las promesas deben seguir funcionando.
const FAKED_ONLY_DATE = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

class InMemorySessionRepository implements SessionRepository {
  readonly sessions = new Map<string, SessionRecord & { reason?: SessionRevocationReason }>();
  readonly owners = new Map<string, SessionOwner>();
  /** Fallos simulados de `rotate` (otra petición rotó primero). */
  loseNextRotations = 0;

  create(input: NewSession): Promise<SessionRecord> {
    const record: SessionRecord = {
      id: randomUUID(),
      userId: input.userId,
      provider: input.provider,
      generation: 0,
      rotatedAt: null,
      renewedAt: input.now,
      expiresAt: input.expiresAt,
      revokedAt: null,
    };
    this.sessions.set(record.id, record);
    return Promise.resolve({ ...record });
  }

  findWithOwner(id: string): Promise<SessionWithOwner | null> {
    const session = this.sessions.get(id);
    const user = session ? this.owners.get(session.userId) : undefined;
    return Promise.resolve(session && user ? { session: { ...session }, user: { ...user } } : null);
  }

  rotate(id: string, expectedGeneration: number, now: Date): Promise<boolean> {
    const session = this.sessions.get(id);
    if (this.loseNextRotations > 0 && session) {
      this.loseNextRotations -= 1;
      // La otra petición rotó primero.
      session.generation += 1;
      session.rotatedAt = now;
      session.renewedAt = now;
      return Promise.resolve(false);
    }
    if (!session || session.generation !== expectedGeneration || session.revokedAt) {
      return Promise.resolve(false);
    }
    session.generation += 1;
    session.rotatedAt = now;
    session.renewedAt = now;
    return Promise.resolve(true);
  }

  revoke(ids: string[], reason: SessionRevocationReason, now: Date): Promise<void> {
    for (const id of ids) {
      const session = this.sessions.get(id);
      if (session && !session.revokedAt) {
        session.revokedAt = now;
        session.reason = reason;
      }
    }
    return Promise.resolve();
  }

  revokeAllForUser(
    userId: string,
    reason: SessionRevocationReason,
    now: Date,
    exceptId?: string,
  ): Promise<void> {
    const ids = [...this.sessions.values()]
      .filter((session) => session.userId === userId && session.id !== exceptId)
      .map((session) => session.id);
    return this.revoke(ids, reason, now);
  }

  deleteStale(): Promise<void> {
    return Promise.resolve();
  }
}

const ACCESS_SECRET = 'prueba-acceso-'.padEnd(40, 'a');
const REFRESH_SECRET = 'prueba-renovacion-'.padEnd(40, 'r');

function setup(options: { idleHours?: number; graceSeconds?: number } = {}) {
  const user: User = {
    id: randomUUID(),
    fullName: 'Docente Prueba',
    email: 'docente@gns.test',
    role: UserRole.Teacher,
    status: UserStatus.Active,
    createdById: null,
    createdAt: START,
  };
  const repository = new InMemorySessionRepository();
  repository.owners.set(user.id, { id: user.id, role: user.role, status: user.status });

  const values: Record<string, unknown> = {
    REFRESH_TOKEN_SECRET: REFRESH_SECRET,
    REFRESH_ROTATION_GRACE_SECONDS: options.graceSeconds ?? 30,
    ACCESS_TOKEN_TTL_MINUTES: 15,
    SESSION_IDLE_TIMEOUT_HOURS: options.idleHours ?? 24,
    SESSION_REMEMBER_MAX_DAYS: 7,
  };
  const config = { get: (key: string) => values[key] } as unknown as ConfigService<never, true>;

  // Proveedor falso: demuestra que la sesión no depende de cómo se autenticó el usuario.
  const provider: AuthProvider = {
    name: SessionProvider.Password,
    authenticate: jest.fn((input: unknown): Promise<AuthAttempt> => {
      if (input === 'valido') {
        return Promise.resolve({ ok: true, userId: user.id });
      }
      return Promise.resolve(
        input === 'clave-mala'
          ? { ok: false, reason: 'wrong_password', userId: user.id }
          : { ok: false, reason: 'unknown_account', userId: null },
      );
    }),
  };
  const users = {
    find: (id: string) => Promise.resolve(id === user.id ? user : null),
  } as unknown as UsersService;
  const verify = jest.fn(() => Promise.resolve(true));
  const assign = jest.fn(() => Promise.resolve());
  const credentials = { verify, assign } as unknown as CredentialsService;
  // Bitácora falsa: anota si la fila se escribió dentro de una transacción.
  const rows: { entry: AuditEntry; inTransaction: boolean }[] = [];
  let inTransaction = false;
  const failAudit = { next: false };
  const audit = {
    record: jest.fn((entry: AuditEntry) => {
      if (failAudit.next) {
        return Promise.reject(new Error('bitácora caída'));
      }
      rows.push({ entry, inTransaction });
      return Promise.resolve();
    }),
  } as unknown as AuditLogService;
  // Una transacción que, como la real, deshace las sesiones si algo falla.
  const transactions: TransactionRunner = {
    run: async (fn) => {
      const snapshot = new Map([...repository.sessions].map(([key, value]) => [key, { ...value }]));
      inTransaction = true;
      try {
        return await fn();
      } catch (error) {
        repository.sessions.clear();
        snapshot.forEach((value, key) => repository.sessions.set(key, value));
        throw error;
      } finally {
        inTransaction = false;
      }
    },
  };
  const sessions = new SessionsService(repository, config);
  const service = new AuthService(
    [provider],
    users,
    credentials,
    sessions,
    new JwtService({ secret: ACCESS_SECRET, signOptions: { algorithm: 'HS256' } }),
    transactions,
    audit,
    config,
  );
  return { service, repository, user, provider, verify, assign, rows, failAudit };
}

function advance(ms: number): void {
  jest.setSystemTime(new Date(Date.now() + ms));
}

const sessionIdOf = (refreshToken: string): string => refreshToken.split('.')[0] ?? '';

describe('AuthService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: START, doNotFake: [...FAKED_ONLY_DATE] });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('signIn', () => {
    it('issues a session for whatever provider authenticated the user', async () => {
      const { service, repository, user } = setup();

      const { issued, user: profile } = await service.signIn(
        SessionProvider.Password,
        'valido',
        false,
      );

      expect(profile).toEqual({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      });
      expect(repository.sessions.size).toBe(1);
      expect(issued.refreshToken.split('.')[1]).toBe('0');
    });

    it('answers every failure with the same 401', async () => {
      const unknown = setup();
      const inactive = setup();
      inactive.user.status = UserStatus.Inactive;

      for (const [context, input] of [
        [unknown, 'invalido'],
        [inactive, 'valido'],
      ] as const) {
        const error: unknown = await context.service
          .signIn(SessionProvider.Password, input, false)
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error).toMatchObject({ message: INVALID_CREDENTIALS_MESSAGE });
        expect(context.repository.sessions.size).toBe(0);
      }
    });

    it('writes an ingreso row with user, role and session in the same transaction as the session', async () => {
      const { service, rows, user, repository } = setup();

      await service.signIn(SessionProvider.Password, 'valido', false);

      const [sessionId] = [...repository.sessions.keys()];
      expect(rows).toHaveLength(1);
      expect(rows[0]?.inTransaction).toBe(true);
      expect(rows[0]?.entry).toMatchObject({
        userId: user.id,
        role: user.role,
        type: 'ingreso',
        action: 'Ingreso',
        entity: 'sesion',
        entityId: sessionId,
      });
    });

    it('does not issue a session when the ingreso row cannot be written', async () => {
      const { service, repository, failAudit } = setup();
      failAudit.next = true;

      await expect(service.signIn(SessionProvider.Password, 'valido', false)).rejects.toThrow(
        'bitácora caída',
      );
      expect(repository.sessions.size).toBe(0);
    });

    it.each([
      ['unknown account', 'invalido', false, 'Correo no registrado'],
      ['wrong password', 'clave-mala', true, 'Contraseña incorrecta'],
    ])(
      'records a failed attempt (%s) outside any transaction before the 401',
      async (_, input, known, detail) => {
        const { service, rows, user } = setup();

        await expect(service.signIn(SessionProvider.Password, input, false)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );

        expect(rows).toHaveLength(1);
        expect(rows[0]?.inTransaction).toBe(false);
        expect(rows[0]?.entry).toMatchObject({
          userId: known ? user.id : null,
          role: known ? user.role : null,
          type: 'ingreso',
          action: 'Intento de ingreso fallido',
          detail,
        });
      },
    );

    it('records an inactive account with its user and role', async () => {
      const { service, rows, user } = setup();
      user.status = UserStatus.Inactive;

      await expect(
        service.signIn(SessionProvider.Password, 'valido', false),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(rows[0]?.entry).toMatchObject({
        userId: user.id,
        role: user.role,
        detail: 'Cuenta inactiva',
      });
    });

    it('never puts the submitted email, password or tokens in the rows', async () => {
      const { service, rows } = setup();
      const submitted = 'correo-enviado@gns.test';

      await service.signIn(SessionProvider.Password, 'valido', false);
      await service.signIn(SessionProvider.Password, submitted, false).catch(() => undefined);

      expect(JSON.stringify(rows)).not.toContain(submitted);
    });

    it('has no absolute maximum without rememberMe and one of 7 days with it', async () => {
      const { service } = setup();

      const plain = await service.signIn(SessionProvider.Password, 'valido', false);
      const remembered = await service.signIn(SessionProvider.Password, 'valido', true);

      expect(plain.issued.expiresAt).toBeNull();
      expect(remembered.issued.expiresAt).toEqual(new Date(START.getTime() + 7 * 24 * HOUR));
    });
  });

  describe('refresh', () => {
    async function signedIn(options?: Parameters<typeof setup>[0]) {
      const context = setup(options);
      const { issued } = await context.service.signIn(SessionProvider.Password, 'valido', false);
      return { ...context, token0: issued.refreshToken, sid: sessionIdOf(issued.refreshToken) };
    }

    it('rotates: returns the next generation and the previous one stops being current', async () => {
      const { service, repository, token0, sid } = await signedIn();
      advance(60_000);

      const result = await service.refresh(token0);

      expect(result?.issued.refreshToken.split('.')[1]).toBe('1');
      expect(repository.sessions.get(sid)?.generation).toBe(1);
      expect(repository.sessions.get(sid)?.renewedAt).toEqual(new Date(Date.now()));
    });

    it('serves the previous token inside the grace window with the current one, without rotating', async () => {
      const { service, repository, token0, sid } = await signedIn();
      advance(60_000);
      const first = await service.refresh(token0);
      advance(10_000);
      const renewedAt = repository.sessions.get(sid)?.renewedAt;

      const second = await service.refresh(token0);

      expect(second?.issued.refreshToken).toBe(first?.issued.refreshToken);
      expect(second?.issued.accessToken).toBeTruthy();
      expect(repository.sessions.get(sid)?.generation).toBe(1);
      expect(repository.sessions.get(sid)?.renewedAt).toEqual(renewedAt);
      expect(repository.sessions.size).toBe(1);
    });

    it('treats a lost rotation race as a request inside the grace window', async () => {
      const { service, repository, token0, sid } = await signedIn();
      repository.loseNextRotations = 1;

      const result = await service.refresh(token0);

      expect(result?.issued.refreshToken.split('.')[1]).toBe('1');
      expect(repository.sessions.get(sid)?.generation).toBe(1);
    });

    it('revokes every session of the user when a rotated token is reused outside the grace window', async () => {
      const { service, repository, token0, user } = await signedIn();
      const other = await service.signIn(SessionProvider.Password, 'valido', false);
      advance(60_000);
      await service.refresh(token0);
      advance(31_000);
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      const result = await service.refresh(token0);

      expect(result).toBeNull();
      const revoked = [...repository.sessions.values()].filter((s) => s.userId === user.id);
      expect(revoked).toHaveLength(2);
      for (const session of revoked) {
        expect(session.revokedAt).not.toBeNull();
        expect(session.reason).toBe(SessionRevocationReason.TokenReuse);
      }
      expect(await service.refresh(other.issued.refreshToken)).toBeNull();
      expect(JSON.stringify(warn.mock.calls)).not.toContain(token0);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('writes the reuse row in its own transaction before answering null', async () => {
      const { service, rows, user, token0 } = await signedIn();
      advance(60_000);
      await service.refresh(token0);
      advance(31_000);
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      rows.length = 0;

      expect(await service.refresh(token0)).toBeNull();

      expect(rows).toHaveLength(1);
      expect(rows[0]?.inTransaction).toBe(true);
      expect(rows[0]?.entry).toMatchObject({
        userId: user.id,
        role: user.role,
        type: 'ingreso',
        entity: 'sesion',
      });
      expect(JSON.stringify(rows)).not.toContain(token0);
    });

    it('rejects a token from the future, a forged token and a missing one', async () => {
      const { service, token0 } = await signedIn();
      const [sid, , mac] = token0.split('.') as [string, string, string];

      expect(await service.refresh(`${sid}.5.${mac}`)).toBeNull();
      expect(await service.refresh('basura')).toBeNull();
      expect(await service.refresh(undefined)).toBeNull();
    });

    it('expires by inactivity and renewals reset the clock', async () => {
      const { service, token0 } = await signedIn({ idleHours: 24 });
      advance(23 * HOUR);
      const renewed = await service.refresh(token0);
      expect(renewed).not.toBeNull();
      advance(23 * HOUR);
      const next = await service.refresh(renewed?.issued.refreshToken);
      expect(next).not.toBeNull();

      advance(24 * HOUR + 1);

      expect(await service.refresh(next?.issued.refreshToken)).toBeNull();
    });

    it('expires at the absolute maximum of rememberMe even when renewed continuously', async () => {
      const { service } = setup();
      const { issued } = await service.signIn(SessionProvider.Password, 'valido', true);
      let token = issued.refreshToken;

      for (let day = 1; day <= 7; day += 1) {
        advance(23 * HOUR);
        const renewed = await service.refresh(token);
        expect(renewed?.issued.expiresAt).toEqual(issued.expiresAt);
        token = renewed?.issued.refreshToken ?? '';
      }
      advance(23 * HOUR);

      expect(await service.refresh(token)).toBeNull();
    });

    it('rejects a revoked session', async () => {
      const { service, token0, sid } = await signedIn();
      await service.logout(token0, undefined);

      expect(await service.refresh(token0)).toBeNull();
      expect(sid).toBeTruthy();
    });
  });

  describe('authenticate', () => {
    it('identifies the user with the role stored in the database', async () => {
      const { service, repository, user } = setup();
      const { issued } = await service.signIn(SessionProvider.Password, 'valido', false);
      repository.owners.set(user.id, {
        id: user.id,
        role: UserRole.Coordinator,
        status: user.status,
      });

      const identified = await service.authenticate(issued.accessToken);

      expect(identified).toEqual({
        id: user.id,
        role: UserRole.Coordinator,
        sessionId: sessionIdOf(issued.refreshToken),
      } satisfies RequestUser);
    });

    it('rejects a revoked session, an inactive user and a garbage token', async () => {
      const { service, repository, user } = setup();
      const { issued } = await service.signIn(SessionProvider.Password, 'valido', false);

      expect(await service.authenticate('no-es-un-jwt')).toBeNull();

      repository.owners.set(user.id, { id: user.id, role: user.role, status: UserStatus.Inactive });
      expect(await service.authenticate(issued.accessToken)).toBeNull();

      repository.owners.set(user.id, { id: user.id, role: user.role, status: UserStatus.Active });
      await service.logout(undefined, sessionIdOf(issued.refreshToken));
      expect(await service.authenticate(issued.accessToken)).toBeNull();
    });

    it('rejects an access token that has expired', async () => {
      const { service } = setup();
      const { issued } = await service.signIn(SessionProvider.Password, 'valido', false);

      advance(16 * 60_000);

      expect(await service.authenticate(issued.accessToken)).toBeNull();
    });

    it('rejects a token signed with another secret or without the access type', async () => {
      const { service, user } = setup();
      const { issued } = await service.signIn(SessionProvider.Password, 'valido', false);
      const sid = sessionIdOf(issued.refreshToken);
      const foreign = new JwtService({ secret: 'otro-secreto-'.padEnd(40, 'x') });
      const sameSecret = new JwtService({ secret: ACCESS_SECRET });

      expect(
        await service.authenticate(await foreign.signAsync({ sub: user.id, sid, typ: 'access' })),
      ).toBeNull();
      expect(
        await service.authenticate(await sameSecret.signAsync({ sub: user.id, sid, typ: 'otro' })),
      ).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('rejects a wrong current password without changing anything', async () => {
      const { service, verify, assign, repository } = setup();
      const { issued } = await service.signIn(SessionProvider.Password, 'valido', false);
      const actor = (await service.authenticate(issued.accessToken)) as RequestUser;
      verify.mockResolvedValueOnce(false);

      await expect(
        service.changePassword(actor, 'incorrecta', 'x'.repeat(12)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(assign).not.toHaveBeenCalled();
      expect([...repository.sessions.values()][0]?.revokedAt).toBeNull();
    });

    it('replaces the credential and revokes the other sessions but not the current one', async () => {
      const { service, assign, repository } = setup();
      const current = await service.signIn(SessionProvider.Password, 'valido', false);
      const other = await service.signIn(SessionProvider.Password, 'valido', false);
      const actor = (await service.authenticate(current.issued.accessToken)) as RequestUser;

      await service.changePassword(actor, 'actual', 'x'.repeat(12));

      expect(assign).toHaveBeenCalledWith(actor.id, 'x'.repeat(12));
      expect(repository.sessions.get(actor.sessionId)?.revokedAt).toBeNull();
      expect(repository.sessions.get(sessionIdOf(other.issued.refreshToken))?.reason).toBe(
        SessionRevocationReason.PasswordChange,
      );
    });

    it('writes an ingreso row without passwords inside the transaction', async () => {
      const { service, rows } = setup();
      const current = await service.signIn(SessionProvider.Password, 'valido', false);
      const actor = (await service.authenticate(current.issued.accessToken)) as RequestUser;
      rows.length = 0;

      await service.changePassword(actor, 'actual-secreta', 'nueva-secreta-1');

      expect(rows).toHaveLength(1);
      expect(rows[0]?.inTransaction).toBe(true);
      expect(rows[0]?.entry).toMatchObject({
        userId: actor.id,
        role: actor.role,
        type: 'ingreso',
        action: 'Cambiar la contraseña propia',
      });
      expect(JSON.stringify(rows)).not.toMatch(/secreta/);
    });

    it('does not change the password when the row cannot be written', async () => {
      const { service, failAudit, repository } = setup();
      const current = await service.signIn(SessionProvider.Password, 'valido', false);
      const other = await service.signIn(SessionProvider.Password, 'valido', false);
      const actor = (await service.authenticate(current.issued.accessToken)) as RequestUser;
      failAudit.next = true;

      await expect(service.changePassword(actor, 'actual', 'x'.repeat(12))).rejects.toThrow(
        'bitácora caída',
      );
      expect(repository.sessions.get(sessionIdOf(other.issued.refreshToken))?.revokedAt).toBeNull();
    });
  });
});
