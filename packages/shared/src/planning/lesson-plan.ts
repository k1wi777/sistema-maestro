import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { RecordStatus } from '../constants/record-status';
import { CuriocityStage } from '../constants/planning';
import { createListQuerySchema } from '../list-query/list-query';
import { createApproveReviewSchema, createReturnReviewSchema } from '../review/review';
import { lessonPlanResourceSchema } from './lesson-plan-resource';

export const LESSON_PLAN_TOPIC_MAX_LENGTH = 160;
export const LESSON_PLAN_CORNER_MAX_LENGTH = 60;
/** Protege el tamaño de la bitácora y de `revision.cambios`. */
export const LESSON_PLAN_TEXT_MAX_LENGTH = 4000;
export const VOID_REASON_MIN_LENGTH = 3;
export const VOID_REASON_MAX_LENGTH = 300;

const uuid = z.uuid({ error: 'debe ser un UUID' });

const statusSchema = z.enum(Object.values(RecordStatus) as [RecordStatus, ...RecordStatus[]], {
  error: 'estado no permitido',
});

/** Texto recortado; vacío se guarda como `null` y `null` vacía el campo. */
const optionalText = (maxLength: number) =>
  z
    .string({ error: 'debe ser texto' })
    .trim()
    .max(maxLength, `debe tener como máximo ${maxLength} caracteres`)
    .nullable()
    .transform((value) => value || null)
    .optional();

const optionalDate = z.iso.date({ error: 'debe ser una fecha AAAA-MM-DD' }).nullable().optional();

/** Campos de contenido de una planeación (los que el dueño edita y coordinación ajusta). */
const contentShape = {
  dateFrom: optionalDate,
  dateTo: optionalDate,
  topic: optionalText(LESSON_PLAN_TOPIC_MAX_LENGTH),
  expectedPerformance: optionalText(LESSON_PLAN_TEXT_MAX_LENGTH),
  learningCorner: optionalText(LESSON_PLAN_CORNER_MAX_LENGTH),
  curiocityStage: z
    .enum(Object.values(CuriocityStage) as [CuriocityStage, ...CuriocityStage[]], {
      error: 'etapa no permitida',
    })
    .nullable()
    .optional(),
  explorationMoment: optionalText(LESSON_PLAN_TEXT_MAX_LENGTH),
  developmentMoment: optionalText(LESSON_PLAN_TEXT_MAX_LENGTH),
  socializationMoment: optionalText(LESSON_PLAN_TEXT_MAX_LENGTH),
  closingMoment: optionalText(LESSON_PLAN_TEXT_MAX_LENGTH),
  resources: optionalText(LESSON_PLAN_TEXT_MAX_LENGTH),
  reasonableAdjustments: optionalText(LESSON_PLAN_TEXT_MAX_LENGTH),
};

const atLeastOneField = { error: 'debe incluir al menos un campo' };

/** Planeación tal como la devuelve la API; nunca incluye datos de estudiantes. */
export const lessonPlanSchema = z.object({
  id: z.uuid(),
  teacher: z.object({ id: z.uuid(), fullName: z.string() }),
  grade: z.object({ id: z.uuid(), name: z.string() }),
  level: z.object({ id: z.uuid(), name: z.string() }),
  area: z.object({ id: z.uuid(), name: z.string() }),
  period: z.object({ id: z.uuid(), number: z.number().int(), schoolYear: z.string() }),
  dateFrom: z.string().nullable(),
  dateTo: z.string().nullable(),
  topic: z.string().nullable(),
  crossCuttingProject: z.string().nullable(),
  expectedPerformance: z.string().nullable(),
  learningCorner: z.string().nullable(),
  curiocityStage: z.string().nullable(),
  explorationMoment: z.string().nullable(),
  developmentMoment: z.string().nullable(),
  socializationMoment: z.string().nullable(),
  closingMoment: z.string().nullable(),
  resources: z.string().nullable(),
  reasonableAdjustments: z.string().nullable(),
  status: statusSchema,
  submittedAt: isoDateTimeSchema.nullable(),
  linkedResources: z.array(lessonPlanResourceSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type LessonPlan = z.output<typeof lessonPlanSchema>;

/** Grado, área y periodo se eligen al crear; el proyecto transversal lo calcula el servidor. */
export const createLessonPlanSchema = z
  .object({ gradeId: uuid, areaId: uuid, periodId: uuid, ...contentShape })
  .strict();
export type CreateLessonPlanInput = z.output<typeof createLessonPlanSchema>;

/** Grado y área no se editan: cambiarlos es anular y crear otra planeación. */
export const updateLessonPlanSchema = z
  .object({ periodId: uuid.optional(), ...contentShape })
  .strict()
  .refine((value) => Object.keys(value).length > 0, atLeastOneField);
export type UpdateLessonPlanInput = z.output<typeof updateLessonPlanSchema>;

/** Ajustes de coordinación: solo contenido (sin periodo). */
export const lessonPlanChangesSchema = z
  .object(contentShape)
  .strict()
  .refine((value) => Object.keys(value).length > 0, atLeastOneField);
export type LessonPlanChangesInput = z.output<typeof lessonPlanChangesSchema>;

export const approveLessonPlanSchema = createApproveReviewSchema(lessonPlanChangesSchema);
export type ApproveLessonPlanInput = z.output<typeof approveLessonPlanSchema>;
export const returnLessonPlanSchema = createReturnReviewSchema(lessonPlanChangesSchema);
export type ReturnLessonPlanInput = z.output<typeof returnLessonPlanSchema>;

export const voidLessonPlanSchema = z
  .object({
    reason: z
      .string({ error: 'debe ser texto' })
      .trim()
      .min(VOID_REASON_MIN_LENGTH, `debe tener al menos ${VOID_REASON_MIN_LENGTH} caracteres`)
      .max(VOID_REASON_MAX_LENGTH, `debe tener como máximo ${VOID_REASON_MAX_LENGTH} caracteres`),
  })
  .strict();
export type VoidLessonPlanInput = z.output<typeof voidLessonPlanSchema>;

export const LESSON_PLAN_SORT_FIELDS = ['updatedAt', 'createdAt', 'submittedAt'] as const;
export type LessonPlanSortField = (typeof LESSON_PLAN_SORT_FIELDS)[number];
export const lessonPlanListQuerySchema = createListQuerySchema({
  sortFields: LESSON_PLAN_SORT_FIELDS,
  defaultSort: { field: 'updatedAt', order: 'desc' },
  filters: {
    status: statusSchema.optional(),
    periodId: uuid.optional(),
    gradeId: uuid.optional(),
    areaId: uuid.optional(),
    teacherId: uuid.optional(),
  },
});
export interface LessonPlanFilters {
  status?: RecordStatus;
  periodId?: string;
  gradeId?: string;
  areaId?: string;
  /** Coordinación filtra por docente; a un docente el servicio lo fuerza a su propio id. */
  teacherId?: string;
}
