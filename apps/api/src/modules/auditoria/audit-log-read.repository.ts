import type { AuditLogFilters, AuditLogType } from '@gns/shared';

/** Fila de la bitácora tal como se guardó, con el nombre del usuario y sin datos antes/después. */
export interface AuditLogRow {
  /** Consecutivo como texto (`bigint`). */
  id: string;
  occurredAt: Date;
  user: { id: string; name: string } | null;
  role: string;
  type: AuditLogType;
  action: string;
  entity: string | null;
  entityId: string | null;
  detail: string | null;
}

export interface AuditLogRowDetail extends AuditLogRow {
  dataBefore: unknown;
  dataAfter: unknown;
}

export interface AuditLogPageResult {
  items: AuditLogRow[];
  nextCursor: string | null;
}

/**
 * Lectura de la bitácora, separada del repository de escritura: aquí no hay ningún método
 * que inserte, actualice o borre. Orden total `fecha_hora DESC, id DESC`.
 */
export interface AuditLogReadRepository {
  /** Página por keyset: las filas posteriores a la del consecutivo `cursor` (o desde el inicio). */
  findPage(
    filters: AuditLogFilters,
    cursor: string | null,
    limit: number,
  ): Promise<AuditLogPageResult>;
  findById(id: string): Promise<AuditLogRowDetail | null>;
  /** Hasta `max` filas con los filtros, en el orden de la bitácora. */
  findForExport(filters: AuditLogFilters, max: number): Promise<AuditLogRow[]>;
}

export const AUDIT_LOG_READ_REPOSITORY = Symbol('AUDIT_LOG_READ_REPOSITORY');
