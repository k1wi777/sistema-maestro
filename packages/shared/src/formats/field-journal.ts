import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { JournalEventType } from '../constants/field-journal';
import { RecordStatus } from '../constants/record-status';
import { createListQuerySchema, createPageSchema } from '../list-query/list-query';
import { createApproveReviewSchema, createReturnReviewSchema } from '../review/review';
import { journalStudentsSchema } from './student-first-name';

export const JOURNAL_LESSON_MAX_LENGTH = 80;
export const JOURNAL_DESCRIPTION_MAX_LENGTH = 1500;
export const JOURNAL_ACTIONS_MAX_LENGTH = 1000;
export const JOURNAL_REFLECTION_MAX_LENGTH = 1000;
export const JOURNAL_ADJUSTED_ENTRIES_MAX = 200;

/**
 * Campos de una entrada que coordinación puede ajustar: clave de la API y columna de
 * `diario_entrada`. La columna es la que se guarda en `revision.cambios`.
 */
export const FIELD_JOURNAL_ENTRY_ADJUSTABLE_FIELDS = {
  date: 'fecha',
  lesson: 'clase',
  eventType: 'tipo_evento',
  students: 'estudiantes',
  description: 'descripcion',
  actions: 'acciones',
  reflection: 'reflexion',
} as const;
export type FieldJournalEntryAdjustableField = keyof typeof FIELD_JOURNAL_ENTRY_ADJUSTABLE_FIELDS;

/** Clave de un ajuste de entrada en `revision.cambios` y `campos_ajustados`. */
export function journalEntryChangeField(entryId: string, column: string): string {
  return `entradas.${entryId}.${column}`;
}

const CHANGE_FIELD = /^entradas\.([0-9a-f-]{36})\.([a-z_]+)$/u;

/** Inversa de `journalEntryChangeField`; `null` si la clave no es de una entrada. */
export function parseJournalEntryChangeField(
  field: string,
): { entryId: string; column: string } | null {
  const match = CHANGE_FIELD.exec(field);
  return match?.[1] && match[2] ? { entryId: match[1], column: match[2] } : null;
}

/** Regla del prototipo: un evento «a mejorar» exige acciones. */
export function journalEntryNeedsActions(
  eventType: string | null | undefined,
  actions: string | null | undefined,
): boolean {
  return eventType === JournalEventType.ToImprove && !actions;
}
export const JOURNAL_ACTIONS_REQUIRED_REASON = 'es obligatorio cuando el evento es «a mejorar»';

const uuid = z.uuid({ error: 'debe ser un UUID' });
const statusSchema = z.enum(Object.values(RecordStatus) as [RecordStatus, ...RecordStatus[]], {
  error: 'estado no permitido',
});
const eventTypeSchema = z.enum(
  Object.values(JournalEventType) as [JournalEventType, ...JournalEventType[]],
  { error: 'tipo de evento no permitido' },
);

const optionalText = (maxLength: number) =>
  z
    .string({ error: 'debe ser texto' })
    .trim()
    .max(maxLength, `debe tener como máximo ${maxLength} caracteres`)
    .nullable()
    .transform((value) => value || null)
    .optional();

const requiredText = (maxLength: number) =>
  z
    .string({ error: 'debe ser texto' })
    .trim()
    .min(1, 'es obligatorio')
    .max(maxLength, `debe tener como máximo ${maxLength} caracteres`);

const entryDate = z.iso.date({ error: 'debe ser una fecha AAAA-MM-DD' });

/** Contenido de una entrada tal como lo edita el dueño y lo ajusta coordinación. */
const entryContentShape = {
  date: entryDate.optional(),
  lesson: requiredText(JOURNAL_LESSON_MAX_LENGTH).optional(),
  eventType: eventTypeSchema.optional(),
  students: journalStudentsSchema.optional(),
  description: requiredText(JOURNAL_DESCRIPTION_MAX_LENGTH).optional(),
  actions: optionalText(JOURNAL_ACTIONS_MAX_LENGTH),
  reflection: optionalText(JOURNAL_REFLECTION_MAX_LENGTH),
};

const atLeastOneField = { error: 'debe incluir al menos un campo' };

export const fieldJournalEntrySchema = z.object({
  id: z.uuid(),
  date: z.string(),
  lesson: z.string().nullable(),
  eventType: eventTypeSchema,
  students: z.array(z.string()),
  description: z.string(),
  actions: z.string().nullable(),
  reflection: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type FieldJournalEntry = z.output<typeof fieldJournalEntrySchema>;

/** Hoja del diario sin sus entradas (listados); `entryCount` resume cuántas tiene. */
export const fieldJournalSummarySchema = z.object({
  id: z.uuid(),
  teacher: z.object({ id: z.uuid(), fullName: z.string() }),
  grade: z.object({ id: z.uuid(), name: z.string() }),
  period: z.object({ id: z.uuid(), number: z.number().int(), schoolYear: z.string() }),
  status: statusSchema,
  submittedAt: isoDateTimeSchema.nullable(),
  entryCount: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type FieldJournalSummary = z.output<typeof fieldJournalSummarySchema>;

export const fieldJournalSchema = fieldJournalSummarySchema.extend({
  entries: z.array(fieldJournalEntrySchema),
});
export type FieldJournal = z.output<typeof fieldJournalSchema>;

export const fieldJournalPageSchema = createPageSchema(fieldJournalSummarySchema);

/** Parámetros de ruta de una entrada: hoja y entrada. */
export const fieldJournalEntryParamSchema = z.object({
  id: uuid,
  entryId: uuid,
});

/** Grado y periodo son la llave de la hoja e inmutables: equivocarse es anular y crear otra. */
export const createFieldJournalSchema = z.object({ gradeId: uuid, periodId: uuid }).strict();
export type CreateFieldJournalInput = z.output<typeof createFieldJournalSchema>;

export const createFieldJournalEntrySchema = z
  .object({
    ...entryContentShape,
    date: entryDate,
    lesson: requiredText(JOURNAL_LESSON_MAX_LENGTH),
    eventType: eventTypeSchema,
    description: requiredText(JOURNAL_DESCRIPTION_MAX_LENGTH),
  })
  .strict()
  .superRefine((value, context) => {
    if (journalEntryNeedsActions(value.eventType, value.actions)) {
      context.addIssue({
        code: 'custom',
        path: ['actions'],
        message: JOURNAL_ACTIONS_REQUIRED_REASON,
      });
    }
  });
export type CreateFieldJournalEntryInput = z.output<typeof createFieldJournalEntrySchema>;

/** PATCH parcial: `null` vacía los opcionales; la regla de «a mejorar» la aplica el servicio. */
export const updateFieldJournalEntrySchema = z
  .object(entryContentShape)
  .strict()
  .refine((value) => Object.keys(value).length > 0, atLeastOneField);
export type UpdateFieldJournalEntryInput = z.output<typeof updateFieldJournalEntrySchema>;

/** Ajuste de coordinación a una entrada existente (nunca crea ni quita entradas). */
export const fieldJournalEntryChangeSchema = z
  .object({ id: uuid, ...entryContentShape })
  .strict()
  .refine((value) => Object.keys(value).length > 1, atLeastOneField);
export type FieldJournalEntryChangeInput = z.output<typeof fieldJournalEntryChangeSchema>;

export const fieldJournalChangesSchema = z
  .object({
    entries: z
      .array(fieldJournalEntryChangeSchema)
      .min(1, 'debe incluir al menos una entrada')
      .max(JOURNAL_ADJUSTED_ENTRIES_MAX, `como máximo ${JOURNAL_ADJUSTED_ENTRIES_MAX} entradas`),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.entries.map((entry) => entry.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        path: ['entries'],
        message: 'no puede repetir entradas',
      });
    }
  });
export type FieldJournalChangesInput = z.output<typeof fieldJournalChangesSchema>;

export const approveFieldJournalSchema = createApproveReviewSchema(fieldJournalChangesSchema);
export type ApproveFieldJournalInput = z.output<typeof approveFieldJournalSchema>;
export const returnFieldJournalSchema = createReturnReviewSchema(fieldJournalChangesSchema);
export type ReturnFieldJournalInput = z.output<typeof returnFieldJournalSchema>;

export const FIELD_JOURNAL_SORT_FIELDS = ['updatedAt', 'createdAt', 'submittedAt'] as const;
export type FieldJournalSortField = (typeof FIELD_JOURNAL_SORT_FIELDS)[number];
export const fieldJournalListQuerySchema = createListQuerySchema({
  sortFields: FIELD_JOURNAL_SORT_FIELDS,
  defaultSort: { field: 'updatedAt', order: 'desc' },
  filters: {
    status: statusSchema.optional(),
    gradeId: uuid.optional(),
    periodId: uuid.optional(),
    teacherId: uuid.optional(),
  },
});
export interface FieldJournalFilters {
  status?: RecordStatus;
  gradeId?: string;
  periodId?: string;
  /** Coordinación filtra por docente; a un docente el servicio lo fuerza a su propio id. */
  teacherId?: string;
}
