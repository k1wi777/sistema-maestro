import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { ReviewAction } from '../constants/review';

export const REVIEW_COMMENT_MAX_LENGTH = 2000;
export const VOID_REASON_MIN_LENGTH = 3;
export const VOID_REASON_MAX_LENGTH = 300;

/** Cambio de un campo ajustado por coordinación; `field` es la columna de la base. */
export const reviewFieldChangeSchema = z.object({
  field: z.string(),
  before: z.unknown(),
  after: z.unknown(),
});
export type ReviewFieldChange = z.output<typeof reviewFieldChangeSchema>;

/** Fila del historial de revisión de un registro (el ajuste va antes de su decisión). */
export const reviewSchema = z.object({
  id: z.uuid(),
  action: z.enum(Object.values(ReviewAction) as [ReviewAction, ...ReviewAction[]]),
  comment: z.string().nullable(),
  reviewer: z.object({ id: z.uuid(), fullName: z.string() }),
  date: isoDateTimeSchema,
  adjustedFields: z.array(z.string()),
  /** Vacío en las filas que no guardaron valores (p. ej. los ajustes de los datos demo). */
  changes: z.array(reviewFieldChangeSchema),
});
export type Review = z.output<typeof reviewSchema>;

const trimmedComment = z
  .string({ error: 'debe ser texto' })
  .trim()
  .max(REVIEW_COMMENT_MAX_LENGTH, `debe tener como máximo ${REVIEW_COMMENT_MAX_LENGTH} caracteres`);

/**
 * Cuerpo de aprobar: comentario opcional y ajustes opcionales del registro. `changes` es el
 * esquema de los campos ajustables de cada tipo de registro.
 */
export function createApproveReviewSchema<TChanges extends z.ZodType>(changes: TChanges) {
  return z
    .object({
      comment: trimmedComment.transform((value) => value || null).optional(),
      changes: changes.optional(),
    })
    .strict();
}

/** Cuerpo de devolver: comentario obligatorio y ajustes opcionales. */
export function createReturnReviewSchema<TChanges extends z.ZodType>(changes: TChanges) {
  return z
    .object({
      comment: trimmedComment.min(1, 'es obligatorio para devolver con observaciones'),
      changes: changes.optional(),
    })
    .strict();
}

/** Valor comparable: fechas a `AAAA-MM-DD`, y `undefined` y texto vacío como `null`. */
function normalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value === undefined || value === '' ? null : value;
}

/**
 * Compara los campos de `columnMap` (clave de la API → columna) y devuelve solo los que
 * cambiaron, con el nombre de la columna. Los valores de `before` y `after` se indexan por
 * clave de la API.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  columnMap: Record<string, string>,
): ReviewFieldChange[] {
  const changes: ReviewFieldChange[] = [];
  for (const [key, column] of Object.entries(columnMap)) {
    const previous = normalize(before[key]);
    const next = normalize(after[key]);
    if (previous !== next) {
      changes.push({ field: column, before: previous, after: next });
    }
  }
  return changes;
}

/** Forma guardada en `revision.cambios`: `{ columna: { antes, despues } }`. */
export type StoredReviewChanges = Record<string, { antes: unknown; despues: unknown }>;

export function toStoredChanges(changes: readonly ReviewFieldChange[]): StoredReviewChanges {
  return Object.fromEntries(
    changes.map(({ field, before, after }) => [field, { antes: before, despues: after }]),
  );
}

/** Inversa de `toStoredChanges`; `null` (filas sin valores guardados) da una lista vacía. */
export function fromStoredChanges(stored: unknown): ReviewFieldChange[] {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    return [];
  }
  return Object.entries(stored as StoredReviewChanges).map(([field, value]) => ({
    field,
    before: value.antes ?? null,
    after: value.despues ?? null,
  }));
}

/** Cuerpo de anular un registro pedagógico: el motivo queda en la bitácora. */
export const voidRecordSchema = z
  .object({
    reason: z
      .string({ error: 'debe ser texto' })
      .trim()
      .min(VOID_REASON_MIN_LENGTH, `debe tener al menos ${VOID_REASON_MIN_LENGTH} caracteres`)
      .max(VOID_REASON_MAX_LENGTH, `debe tener como máximo ${VOID_REASON_MAX_LENGTH} caracteres`),
  })
  .strict();
export type VoidRecordInput = z.output<typeof voidRecordSchema>;
