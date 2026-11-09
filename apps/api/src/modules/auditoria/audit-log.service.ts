import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_UNKNOWN_ROLE, type AuditLogType } from '@gns/shared';
import { prepareAuditData } from '../../core/audit/audit-data';
import { AUDIT_LOG_REPOSITORY, type AuditLogRepository } from './audit-log.repository';

export interface AuditEntry {
  /** Usuario de la sesión; `null` sin sesión. */
  userId?: string | null;
  /** Rol de la sesión; sin él se registra `desconocido`. */
  role?: string | null;
  type: AuditLogType;
  action: string;
  /** Tabla en español de la entidad (`pregunta_frecuente`). */
  entity?: string | null;
  entityId?: string | null;
  detail?: string | null;
  dataBefore?: unknown;
  dataAfter?: unknown;
}

// Longitudes de las columnas de `bitacora`.
const MAX_ROLE = 20;
const MAX_ACTION = 160;
const MAX_ENTITY = 40;

@Injectable()
export class AuditLogService {
  constructor(@Inject(AUDIT_LOG_REPOSITORY) private readonly repository: AuditLogRepository) {}

  /**
   * Escribe una fila en la bitácora. Dentro de una transacción activa se confirma o
   * se revoca con ella. Oculta los campos secretos y limita el tamaño de los datos.
   */
  record(entry: AuditEntry): Promise<void> {
    return this.repository.insert({
      userId: entry.userId ?? null,
      role: (entry.role ?? AUDIT_UNKNOWN_ROLE).slice(0, MAX_ROLE),
      type: entry.type,
      action: entry.action.slice(0, MAX_ACTION),
      entity: entry.entity?.slice(0, MAX_ENTITY) ?? null,
      entityId: entry.entityId ?? null,
      detail: entry.detail ?? null,
      dataBefore: prepareAuditData(entry.dataBefore),
      dataAfter: prepareAuditData(entry.dataAfter),
    });
  }
}
