import type { SessionProvider, SessionRevocationReason, UserRole, UserStatus } from '@gns/shared';

export interface SessionRecord {
  id: string;
  userId: string;
  provider: SessionProvider;
  /** Generación vigente del token de renovación. */
  generation: number;
  /** Última rotación: inicio del margen en el que el token anterior aún vale. */
  rotatedAt: Date | null;
  /** Último ingreso o renovación: base del plazo de inactividad. */
  renewedAt: Date;
  /** Máximo absoluto de «mantener la sesión iniciada»; nulo si no se marcó. */
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export interface SessionOwner {
  id: string;
  role: UserRole;
  status: UserStatus;
}

export interface SessionWithOwner {
  session: SessionRecord;
  user: SessionOwner;
}

export interface NewSession {
  userId: string;
  provider: SessionProvider;
  now: Date;
  expiresAt: Date | null;
}

export interface StaleSessionCriteria {
  now: Date;
  /** Las sesiones sin renovar desde antes de este instante están vencidas por inactividad. */
  idleCutoff: Date;
}

export interface SessionRepository {
  create(input: NewSession): Promise<SessionRecord>;
  /** La sesión con su usuario en una sola consulta. */
  findWithOwner(id: string): Promise<SessionWithOwner | null>;
  /**
   * Rota el token de renovación solo si la generación vigente sigue siendo
   * `expectedGeneration` y la sesión no está revocada; devuelve si lo hizo.
   */
  rotate(id: string, expectedGeneration: number, now: Date): Promise<boolean>;
  /** Revoca las sesiones indicadas que aún no lo estén. */
  revoke(ids: string[], reason: SessionRevocationReason, now: Date): Promise<void>;
  /** Revoca todas las sesiones activas del usuario, salvo `exceptId`. */
  revokeAllForUser(
    userId: string,
    reason: SessionRevocationReason,
    now: Date,
    exceptId?: string,
  ): Promise<void>;
  /**
   * Borra las sesiones del usuario vencidas o revocadas, salvo las revocadas por
   * reutilización, que se conservan como constancia.
   */
  deleteStale(userId: string, criteria: StaleSessionCriteria): Promise<void>;
}

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
