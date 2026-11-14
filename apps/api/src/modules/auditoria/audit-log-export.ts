import { type CsvValue, toCsv } from '../../shared/csv/csv';
import { formatBogotaDateOnly, formatBogotaTimestamp } from '../../shared/time/bogota-time';
import type { AuditLogRow } from './audit-log-read.repository';

export const EXPORT_HEADER = [
  'N.º',
  'Fecha y hora',
  'Usuario',
  'Rol',
  'Tipo',
  'Acción',
  'Entidad',
  'ID de la entidad',
  'Detalle',
] as const;

/**
 * Una fila por registro, con lo guardado en la bitácora. Sin datos antes/después: pueden pesar
 * hasta 64 KB y una celda de Excel admite 32 767 caracteres. La acción y el detalle son texto de
 * usuarios: `toCsv` neutraliza las fórmulas.
 */
export function exportRows(rows: readonly AuditLogRow[]): CsvValue[][] {
  return rows.map((row) => [
    row.id,
    formatBogotaTimestamp(row.occurredAt),
    row.user?.name ?? '',
    row.role,
    row.type,
    row.action,
    row.entity ?? '',
    row.entityId ?? '',
    row.detail ?? '',
  ]);
}

export function exportCsv(rows: readonly AuditLogRow[]): string {
  return toCsv(EXPORT_HEADER, exportRows(rows));
}

/** `bitacora-<aaaa-mm-dd>.csv` con la fecha de Colombia. */
export function exportFileName(date: Date): string {
  return `bitacora-${formatBogotaDateOnly(date)}.csv`;
}
