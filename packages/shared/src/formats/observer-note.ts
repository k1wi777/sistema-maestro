import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { ObserverNoteType } from '../constants/observer';
import { RecordStatus } from '../constants/record-status';
import { createListQuerySchema, createPageSchema } from '../list-query/list-query';
import { createApproveReviewSchema, createReturnReviewSchema } from '../review/review';
import { studentFirstNameSchema } from './student-first-name';

export const OBSERVER_DESCRIPTION_MAX_LENGTH = 1500;
export const OBSERVER_ACTIONS_MAX_LENGTH = 1000;
export const OBSERVER_LONG_TEXT_MAX_LENGTH = 800;

/** Tipos que la bandeja muestra primero (situaciones tipo II y III de la Ley 1620). */
export const OBSERVER_PRIORITY_TYPES: readonly ObserverNoteType[] = [
  ObserverNoteType.TypeII,
  ObserverNoteType.TypeIII,
];

/**
 * Campos de una anotación que coordinación puede ajustar (todos menos el grado): clave de la
 * API y columna de `observador_anotacion`.
 */
export const OBSERVER_NOTE_ADJUSTABLE_FIELDS = {
  studentFirstName: 'estudiante_nombre',
  date: 'fecha',
  type: 'tipo',
  description: 'descripcion',
  studentVersion: 'version_estudiante',
  actions: 'acciones',
  familyInformed: 'familia_informada',
  followUp: 'seguimiento',
} as const;
export type ObserverNoteAdjustableField = keyof typeof OBSERVER_NOTE_ADJUSTABLE_FIELDS;

const uuid = z.uuid({ error: 'debe ser un UUID' });
const statusSchema = z.enum(Object.values(RecordStatus) as [RecordStatus, ...RecordStatus[]], {
  error: 'estado no permitido',
});
const typeSchema = z.enum(
  Object.values(ObserverNoteType) as [ObserverNoteType, ...ObserverNoteType[]],
  { error: 'tipo de anotación no permitido' },
);

const optionalText = (maxLength: number) =>
  z
    .string({ error: 'debe ser texto' })
    .trim()
    .max(maxLength, `debe tener como máximo ${maxLength} caracteres`)
    .nullable()
    .transform((value) => value || null)
    .optional();

const descriptionSchema = z
  .string({ error: 'debe ser texto' })
  .trim()
  .min(1, 'es obligatorio')
  .max(
    OBSERVER_DESCRIPTION_MAX_LENGTH,
    `debe tener como máximo ${OBSERVER_DESCRIPTION_MAX_LENGTH} caracteres`,
  );
const dateSchema = z.iso.date({ error: 'debe ser una fecha AAAA-MM-DD' });
const booleanSchema = z.boolean({ error: 'debe ser verdadero o falso' });

const contentShape = {
  studentFirstName: studentFirstNameSchema.optional(),
  date: dateSchema.optional(),
  type: typeSchema.optional(),
  description: descriptionSchema.optional(),
  studentVersion: optionalText(OBSERVER_LONG_TEXT_MAX_LENGTH),
  actions: optionalText(OBSERVER_ACTIONS_MAX_LENGTH),
  familyInformed: booleanSchema.optional(),
  followUp: optionalText(OBSERVER_LONG_TEXT_MAX_LENGTH),
};

const atLeastOneField = { error: 'debe incluir al menos un campo' };

/** Anotación tal como la devuelve la API: solo el nombre de pila del estudiante. */
export const observerNoteSchema = z.object({
  id: z.uuid(),
  teacher: z.object({ id: z.uuid(), fullName: z.string() }),
  grade: z.object({ id: z.uuid(), name: z.string() }),
  studentFirstName: z.string(),
  date: z.string(),
  type: typeSchema,
  description: z.string(),
  studentVersion: z.string().nullable(),
  actions: z.string().nullable(),
  familyInformed: z.boolean(),
  followUp: z.string().nullable(),
  status: statusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type ObserverNote = z.output<typeof observerNoteSchema>;
export const observerNotePageSchema = createPageSchema(observerNoteSchema);

/** Cualquier grado existente: anotar no exige asignación. */
export const createObserverNoteSchema = z
  .object({
    ...contentShape,
    gradeId: uuid,
    studentFirstName: studentFirstNameSchema,
    date: dateSchema,
    type: typeSchema,
    description: descriptionSchema,
    familyInformed: booleanSchema.default(false),
  })
  .strict();
export type CreateObserverNoteInput = z.output<typeof createObserverNoteSchema>;

/** Todo salvo el grado. */
export const updateObserverNoteSchema = z
  .object(contentShape)
  .strict()
  .refine((value) => Object.keys(value).length > 0, atLeastOneField);
export type UpdateObserverNoteInput = z.output<typeof updateObserverNoteSchema>;

/** Ajustes de coordinación: los mismos campos que edita el dueño. */
export const observerNoteChangesSchema = updateObserverNoteSchema;
export type ObserverNoteChangesInput = UpdateObserverNoteInput;

export const approveObserverNoteSchema = createApproveReviewSchema(observerNoteChangesSchema);
export type ApproveObserverNoteInput = z.output<typeof approveObserverNoteSchema>;
export const returnObserverNoteSchema = createReturnReviewSchema(observerNoteChangesSchema);
export type ReturnObserverNoteInput = z.output<typeof returnObserverNoteSchema>;

/** `priority` pone primero tipo II y III y, dentro de cada grupo, ordena por fecha. */
export const OBSERVER_NOTE_SORT_FIELDS = ['priority', 'date', 'updatedAt', 'createdAt'] as const;
export type ObserverNoteSortField = (typeof OBSERVER_NOTE_SORT_FIELDS)[number];
export const observerNoteListQuerySchema = createListQuerySchema({
  sortFields: OBSERVER_NOTE_SORT_FIELDS,
  defaultSort: { field: 'priority', order: 'desc' },
  filters: {
    status: statusSchema.optional(),
    gradeId: uuid.optional(),
    type: typeSchema.optional(),
    teacherId: uuid.optional(),
    periodId: uuid.optional(),
  },
});
export interface ObserverNoteFilters {
  status?: RecordStatus;
  gradeId?: string;
  type?: ObserverNoteType;
  /** Coordinación filtra por docente; a un docente el servicio lo fuerza a su propio id. */
  teacherId?: string;
  /** Se traduce a las fechas del periodo: la anotación no tiene periodo propio. */
  periodId?: string;
}
