import { AUDIT_UNKNOWN_ROLE, AuditLogType, UserRole } from '@gns/shared';

/** Filtros de la bitácora; viven en la URL. Las fechas son `aaaa-mm-dd` (días de Colombia). */
export type AuditRole = UserRole | typeof AUDIT_UNKNOWN_ROLE;

export interface AuditFilters {
  userId?: string;
  role?: AuditRole;
  type?: AuditLogType;
  from?: string;
  to?: string;
}

export const DATE_RANGE_MESSAGE = 'La fecha final debe ser igual o posterior a la inicial.';

const ROLES: readonly AuditRole[] = [
  UserRole.Teacher,
  UserRole.Coordinator,
  UserRole.Administrator,
  AUDIT_UNKNOWN_ROLE,
];
const TYPES: readonly AuditLogType[] = Object.values(AuditLogType);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

function asDate(value: string | null): string | undefined {
  if (value === null || !DATE.test(value)) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? value : undefined;
}

/** Lee los filtros de la URL; un valor que no es un id, rol, tipo o fecha válidos se ignora. */
export function auditFiltersFromParams(params: {
  get: (name: string) => string | null;
}): AuditFilters {
  const userId = params.get('userId');
  const role = params.get('role');
  const type = params.get('type');
  return {
    userId: userId !== null && UUID.test(userId) ? userId : undefined,
    role: ROLES.find((candidate) => candidate === role),
    type: TYPES.find((candidate) => candidate === type),
    from: asDate(params.get('from')),
    to: asDate(params.get('to')),
  };
}

/** Error del campo «Hasta» cuando es anterior a «Desde»; `null` si el rango es válido. */
export function dateRangeError(filters: AuditFilters): string | null {
  return filters.from && filters.to && filters.to < filters.from ? DATE_RANGE_MESSAGE : null;
}

/** Query de la API: solo los filtros con valor. */
export function auditFiltersToQuery(filters: AuditFilters): AuditFilters {
  return {
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  };
}

/** Clave estable de los filtros, para reiniciar la lista al cambiarlos. */
export function auditFiltersKey(filters: AuditFilters): string {
  return JSON.stringify([filters.userId, filters.role, filters.type, filters.from, filters.to]);
}

export function hasActiveAuditFilters(filters: AuditFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined);
}

/** `bitacora-aaaa-mm-dd.csv` con la fecha de hoy en Colombia (la API no expone el nombre por CORS). */
export function exportFileName(now: Date): string {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return `bitacora-${day}.csv`;
}
