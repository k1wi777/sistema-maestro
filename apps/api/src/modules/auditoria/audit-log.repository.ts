import type { AuditLogType } from '@gns/shared';

export interface NewAuditLogEntry {
  userId: string | null;
  role: string;
  type: AuditLogType;
  action: string;
  entity: string | null;
  entityId: string | null;
  detail: string | null;
  /** JSON ya normalizado y sin secretos; `null` se guarda como NULL. */
  dataBefore: unknown;
  dataAfter: unknown;
}

/**
 * La bitácora es de solo inserción (triggers de la base): esta interfaz no declara
 * métodos de actualización ni de borrado. La fecha y hora la pone la base.
 */
export interface AuditLogRepository {
  insert(entry: NewAuditLogEntry): Promise<void>;
}

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');
