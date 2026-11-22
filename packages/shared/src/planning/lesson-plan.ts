import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { AreaType } from '../constants/area';
import { RecordStatus } from '../constants/record-status';
import { CuriocityStage } from '../constants/planning';
import { createListQuerySchema } from '../list-query/list-query';
import {
  coordinatorFilterSchema,
  createApproveReviewSchema,
  createReturnReviewSchema,
  voidRecordSchema,
  type VoidRecordInput,
} from '../review/review';
import { lessonPlanResourceSchema } from './lesson-plan-resource';

export const LESSON_PLAN_TOPIC_MAX_LENGTH = 160;
export const LESSON_PLAN_CORNER_MAX_LENGTH = 60;
/** Protege el tamaño de la bitácora y de `revision.cambios`. */
export const LESSON_PLAN_TEXT_MAX_LENGTH = 4000;

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

/** Áreas de una planeación: al menos una, sin repetidas (tope = tamaño del catálogo). */
const areaIdsSchema = z
  .array(uuid, { error: 'debe ser una lista de áreas' })
  .min(1, 'elige al menos una dimensión o asignatura')
  .max(30, 'no puede tener más de 30 áreas')
  .refine((ids) => new Set(ids).size === ids.length, 'no debe repetir áreas');

/** Nombres de las áreas unidos por «, » (planeación, revisión e impresión lo comparten). */
export function lessonPlanAreasLabel(areas: readonly { name: string }[]): string {
  return areas.map((area) => area.name).join(', ');
}

const atLeastOneField = { error: 'debe incluir al menos un campo' };

/** Planeación tal como la devuelve la API; nunca incluye datos de estudiantes. */
export const lessonPlanSchema = z.object({
  id: z.uuid(),
  teacher: z.object({ id: z.uuid(), fullName: z.string() }),
  grade: z.object({ id: z.uuid(), name: z.string() }),
  level: z.object({ id: z.uuid(), name: z.string() }),
  /** Una o más dimensiones o asignaturas, en orden alfabético. */
  areas: z.array(z.object({ id: z.uuid(), name: z.string() })).min(1),
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

/** Grado, áreas y periodo se eligen al crear; el proyecto transversal lo calcula el servidor. */
export const createLessonPlanSchema = z
  .object({ gradeId: uuid, areaIds: areaIdsSchema, periodId: uuid, ...contentShape })
  .strict();
export type CreateLessonPlanInput = z.output<typeof createLessonPlanSchema>;

/** El grado no se edita (cambiarlo es anular y crear otra planeación); las áreas sí. */
export const updateLessonPlanSchema = z
  .object({ periodId: uuid.optional(), areaIds: areaIdsSchema.optional(), ...contentShape })
  .strict()
  .refine((value) => Object.keys(value).length > 0, atLeastOneField);
export type UpdateLessonPlanInput = z.output<typeof updateLessonPlanSchema>;

/** Ajustes de coordinación: solo contenido (sin periodo ni áreas). */
export const lessonPlanChangesSchema = z
  .object(contentShape)
  .strict()
  .refine((value) => Object.keys(value).length > 0, atLeastOneField);
export type LessonPlanChangesInput = z.output<typeof lessonPlanChangesSchema>;

export const approveLessonPlanSchema = createApproveReviewSchema(lessonPlanChangesSchema);
export type ApproveLessonPlanInput = z.output<typeof approveLessonPlanSchema>;
export const returnLessonPlanSchema = createReturnReviewSchema(lessonPlanChangesSchema);
export type ReturnLessonPlanInput = z.output<typeof returnLessonPlanSchema>;

/** Mismo cuerpo que anular cualquier registro pedagógico (ver `voidRecordSchema`). */
export const voidLessonPlanSchema = voidRecordSchema;
export type VoidLessonPlanInput = VoidRecordInput;

/**
 * Opciones para crear una planeación: los grados con asignación activa del docente en el año
 * vigente y, por grado, las áreas que puede marcar (las del nivel más las que tiene asignadas).
 */
export const lessonPlanOptionsSchema = z.object({
  schoolYear: z.string(),
  grades: z.array(
    z.object({
      grade: z.object({ id: z.uuid(), name: z.string(), sortOrder: z.number().int() }),
      level: z.object({ id: z.uuid(), name: z.string() }),
      areas: z.array(
        z.object({
          id: z.uuid(),
          name: z.string(),
          type: z.enum(Object.values(AreaType) as [AreaType, ...AreaType[]]),
          /** El docente la tiene asignada en este grado. */
          assigned: z.boolean(),
        }),
      ),
    }),
  ),
});
export type LessonPlanOptions = z.output<typeof lessonPlanOptionsSchema>;

export const LESSON_PLAN_SORT_FIELDS = ['updatedAt', 'createdAt', 'submittedAt'] as const;
export type LessonPlanSortField = (typeof LESSON_PLAN_SORT_FIELDS)[number];
export const lessonPlanListQuerySchema = createListQuerySchema({
  sortFields: LESSON_PLAN_SORT_FIELDS,
  defaultSort: { field: 'updatedAt', order: 'desc' },
  filters: {
    status: statusSchema.optional(),
    periodId: uuid.optional(),
    gradeId: uuid.optional(),
    /** Incluye toda planeación que tenga esa área entre las suyas. */
    areaId: uuid.optional(),
    teacherId: uuid.optional(),
    coordinatorId: coordinatorFilterSchema.optional(),
  },
});
export interface LessonPlanFilters {
  status?: RecordStatus;
  periodId?: string;
  gradeId?: string;
  areaId?: string;
  /** Coordinación filtra por docente; a un docente el servicio lo fuerza a su propio id. */
  teacherId?: string;
  /** Coordinadora del grado (UUID) o `none` (sin coordinadora); un docente lo ignora. */
  coordinatorId?: string;
}
