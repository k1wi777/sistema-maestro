import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { AUDIT_UNKNOWN_ROLE, AuditLogType } from '../constants/audit-log';
import { UserRole } from '../constants/user';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../list-query/list-query';

/** Filas máximas de una exportación: más allá se rechaza para no entregar un CSV truncado. */
export const AUDIT_LOG_EXPORT_MAX_ROWS = 10000;

const auditTypes = Object.values(AuditLogType) as [AuditLogType, ...AuditLogType[]];
const auditRoles = [
  UserRole.Teacher,
  UserRole.Coordinator,
  UserRole.Administrator,
  AUDIT_UNKNOWN_ROLE,
] as const;

/** Consecutivo de la bitácora (`bigint`) como texto de dígitos. */
const auditIdPattern = /^\d{1,18}$/;
const auditIdSchema = z.string().regex(auditIdPattern, 'debe ser un consecutivo numérico');

/** Fecha de calendario real `aaaa-mm-dd` (rechaza `2026-02-30`). */
const calendarDateSchema = z
  .string({ error: 'debe ser una fecha aaaa-mm-dd' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'debe tener el formato aaaa-mm-dd')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'no es una fecha válida');

const filterShape = {
  userId: z.uuid({ error: 'debe ser un UUID' }).optional(),
  role: z.enum(auditRoles, { error: 'rol no válido' }).optional(),
  type: z.enum(auditTypes, { error: 'tipo no válido' }).optional(),
  from: calendarDateSchema.optional(),
  to: calendarDateSchema.optional(),
};

const dateRangeIsValid = (value: { from?: string; to?: string }) =>
  value.from === undefined || value.to === undefined || value.from <= value.to;
const dateRangeIssue = {
  message: 'debe ser igual o posterior a la fecha inicial',
  path: ['to'],
};

const limitSchema = z
  .string()
  .regex(/^\d+$/, 'debe ser un entero')
  .transform(Number)
  .pipe(z.number().int().min(1).max(MAX_PAGE_SIZE))
  .default(DEFAULT_PAGE_SIZE);

/** Query del listado de la bitácora: paginación por cursor (consecutivo de la última fila). */
export const auditLogListQuerySchema = z
  .strictObject({
    limit: limitSchema,
    cursor: auditIdSchema.optional(),
    ...filterShape,
  })
  .refine(dateRangeIsValid, dateRangeIssue);
export type AuditLogListQuery = z.output<typeof auditLogListQuerySchema>;

/** Query de la exportación: los mismos filtros, sin paginación. */
export const auditLogExportQuerySchema = z
  .strictObject(filterShape)
  .refine(dateRangeIsValid, dateRangeIssue);
export type AuditLogExportQuery = z.output<typeof auditLogExportQuerySchema>;

/** Filtros ya validados que recibe el repository. */
export type AuditLogFilters = Pick<AuditLogExportQuery, 'userId' | 'role' | 'type' | 'from' | 'to'>;

/**
 * Fila de la bitácora tal como se guardó: sin datos antes/después y solo el nombre del usuario
 * (nunca correo). `role` es el rol que tenía al actuar.
 */
export const auditLogEntrySchema = z.object({
  id: auditIdSchema,
  occurredAt: isoDateTimeSchema,
  user: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  role: z.string(),
  type: z.enum(auditTypes),
  action: z.string(),
  entity: z.string().nullable(),
  entityId: z.uuid().nullable(),
  detail: z.string().nullable(),
});
export type AuditLogEntry = z.output<typeof auditLogEntrySchema>;

export const auditLogEntryDetailSchema = auditLogEntrySchema.extend({
  dataBefore: z.unknown().nullable(),
  dataAfter: z.unknown().nullable(),
});
export type AuditLogEntryDetail = z.output<typeof auditLogEntryDetailSchema>;

export const auditLogPageSchema = z.object({
  items: z.array(auditLogEntrySchema),
  /** Cursor de la página siguiente; `null` en la última. */
  nextCursor: auditIdSchema.nullable(),
});
export type AuditLogPage = z.output<typeof auditLogPageSchema>;

/** Parámetro de ruta `:id` de la bitácora: solo dígitos, así `export` nunca se confunde con un id. */
export const auditLogIdParamSchema = z.object({ id: auditIdSchema });
