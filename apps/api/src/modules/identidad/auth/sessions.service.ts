import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus, type SessionProvider, type SessionRevocationReason } from '@gns/shared';
import type { Env } from '../../../core/config/env.validation';
import {
  SESSION_REPOSITORY,
  type SessionRecord,
  type SessionRepository,
  type SessionWithOwner,
} from './session.repository';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Ciclo de vida de las sesiones: crear, validar, rotar y revocar. No conoce proveedores ni tokens. */
@Injectable()
export class SessionsService {
  private readonly idleMs: number;
  private readonly rememberMs: number;

  constructor(
    @Inject(SESSION_REPOSITORY) private readonly repository: SessionRepository,
    config: ConfigService<Env, true>,
  ) {
    this.idleMs = config.get('SESSION_IDLE_TIMEOUT_HOURS', { infer: true }) * HOUR_MS;
    this.rememberMs = config.get('SESSION_REMEMBER_MAX_DAYS', { infer: true }) * DAY_MS;
  }

  /**
   * Crea una sesión. Con `rememberMe` queda un máximo absoluto; sin él, solo la
   * inactividad la vence. Aprovecha para borrar las sesiones viejas del usuario.
   */
  async create(
    userId: string,
    provider: SessionProvider,
    rememberMe: boolean,
    now: Date,
  ): Promise<SessionRecord> {
    await this.repository.deleteStale(userId, {
      now,
      idleCutoff: new Date(now.getTime() - this.idleMs),
    });
    return this.repository.create({
      userId,
      provider,
      now,
      expiresAt: rememberMe ? new Date(now.getTime() + this.rememberMs) : null,
    });
  }

  find(id: string): Promise<SessionWithOwner | null> {
    return this.repository.findWithOwner(id);
  }

  /** Válida: no revocada, sin vencer por inactividad ni por su máximo, de un usuario activo. */
  isValid({ session, user }: SessionWithOwner, now: Date): boolean {
    return (
      user.status === UserStatus.Active &&
      session.revokedAt === null &&
      now.getTime() < session.renewedAt.getTime() + this.idleMs &&
      (session.expiresAt === null || now.getTime() < session.expiresAt.getTime())
    );
  }

  rotate(session: SessionRecord, now: Date): Promise<boolean> {
    return this.repository.rotate(session.id, session.generation, now);
  }

  revoke(ids: string[], reason: SessionRevocationReason, now = new Date()): Promise<void> {
    return this.repository.revoke(ids, reason, now);
  }

  revokeAllForUser(
    userId: string,
    reason: SessionRevocationReason,
    exceptId?: string,
    now = new Date(),
  ): Promise<void> {
    return this.repository.revokeAllForUser(userId, reason, now, exceptId);
  }
}
