import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { SharedActivityType } from '../constants/planning';
import { createListQuerySchema } from '../list-query/list-query';
import { LESSON_PLAN_CORNER_MAX_LENGTH } from './lesson-plan';
import { resourceUrlSchema } from './lesson-plan-resource';
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH } from './search-text';

export const SHARED_ACTIVITY_TITLE_MAX_LENGTH = 160;
/** Protege el tamaño de la bitácora, que conserva el contenido de lo retirado. */
export const SHARED_ACTIVITY_TEXT_MAX_LENGTH = 4000;
/** Una jornada escolar; la columna es `SMALLINT`. */
export const SHARED_ACTIVITY_MAX_DURATION_MINUTES = 480;

/** Igual al de la planeación, para que todo rincón de planeación quepa al compartirla. */
export const SHARED_ACTIVITY_CORNER_MAX_LENGTH = LESSON_PLAN_CORNER_MAX_LENGTH;
/** Tope de rincones distintos que devuelve la ruta de rincones en uso. */
export const SHARED_ACTIVITY_CORNERS_MAX_ITEMS = 200;

const uuid = z.uuid({ error: 'debe ser un UUID' });

const requiredText = (maxLength: number) =>
  z
    .string({ error: 'debe ser texto' })
    .trim()
    .min(1, 'no puede estar vacío')
    .max(maxLength, `debe tener como máximo ${maxLength} caracteres`);

/** Texto recortado; vacío se guarda como `null` y `null` vacía el campo. */
const optionalText = z
  .string({ error: 'debe ser texto' })
  .trim()
  .max(
    SHARED_ACTIVITY_TEXT_MAX_LENGTH,
    `debe tener como máximo ${SHARED_ACTIVITY_TEXT_MAX_LENGTH} caracteres`,
  )
  .nullable()
  .transform((value) => value || null)
  .optional();

const activityTypeSchema = z.enum(
  Object.values(SharedActivityType) as [SharedActivityType, ...SharedActivityType[]],
  { error: 'tipo no permitido' },
);

/** Rincón recortado de hasta 60 caracteres; vacío se guarda como `null`. */
const cornerText = z
  .string({ error: 'debe ser texto' })
  .trim()
  .max(
    SHARED_ACTIVITY_CORNER_MAX_LENGTH,
    `debe tener como máximo ${SHARED_ACTIVITY_CORNER_MAX_LENGTH} caracteres`,
  )
  .nullable()
  .transform((value) => value || null)
  .optional();

const atLeastOneField = { error: 'debe incluir al menos un campo' };

/** Actividad tal como la devuelve la API; el autor sin correo y nunca datos de estudiantes. */
export const sharedActivitySchema = z.object({
  id: z.uuid(),
  author: z.object({ id: z.uuid(), fullName: z.string() }),
  level: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  area: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  /** Nulo: la actividad sirve a todo el nivel. */
  grade: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  learningCorner: z.string().nullable(),
  activityType: activityTypeSchema,
  title: z.string(),
  objective: z.string().nullable(),
  durationMinutes: z.number().int().nullable(),
  materials: z.string().nullable(),
  steps: z.string(),
  link: z.string().nullable(),
  /** Si es favorita de quien consulta. */
  isFavorite: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type SharedActivity = z.output<typeof sharedActivitySchema>;

/** Estricto: rechaza cualquier campo desconocido, en particular datos de estudiantes. */
const contentShape = {
  title: requiredText(SHARED_ACTIVITY_TITLE_MAX_LENGTH),
  steps: requiredText(SHARED_ACTIVITY_TEXT_MAX_LENGTH),
  objective: optionalText,
  materials: optionalText,
  durationMinutes: z
    .number({ error: 'debe ser un número' })
    .int('debe ser un entero')
    .min(1, 'debe ser al menos 1')
    .max(
      SHARED_ACTIVITY_MAX_DURATION_MINUTES,
      `debe ser como máximo ${SHARED_ACTIVITY_MAX_DURATION_MINUTES}`,
    )
    .nullable()
    .optional(),
  link: resourceUrlSchema.nullable().optional(),
  levelId: uuid.nullable().optional(),
  areaId: uuid.nullable().optional(),
  gradeId: uuid.nullable().optional(),
  learningCorner: cornerText,
};

export const createSharedActivitySchema = z
  .object({
    ...contentShape,
    activityType: activityTypeSchema.default(SharedActivityType.Activity),
  })
  .strict();
export type CreateSharedActivityInput = z.output<typeof createSharedActivitySchema>;

/** Sin el valor por defecto del tipo: `partial()` lo volvería a rellenar y editar lo cambiaría. */
export const updateSharedActivitySchema = z
  .object({ ...contentShape, activityType: activityTypeSchema })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, atLeastOneField);
export type UpdateSharedActivityInput = z.output<typeof updateSharedActivitySchema>;

export const SHARED_ACTIVITY_SORT_FIELDS = ['createdAt', 'updatedAt', 'title'] as const;
export type SharedActivitySortField = (typeof SHARED_ACTIVITY_SORT_FIELDS)[number];
export const sharedActivityListQuerySchema = createListQuerySchema({
  sortFields: SHARED_ACTIVITY_SORT_FIELDS,
  defaultSort: { field: 'createdAt', order: 'desc' },
  filters: {
    q: z
      .string()
      .trim()
      .min(SEARCH_MIN_LENGTH, `debe tener al menos ${SEARCH_MIN_LENGTH} caracteres`)
      .max(SEARCH_MAX_LENGTH, `debe tener como máximo ${SEARCH_MAX_LENGTH} caracteres`)
      .optional(),
    levelId: uuid.optional(),
    areaId: uuid.optional(),
    authorId: uuid.optional(),
    /** Incluye las actividades sin grado del nivel de ese grado. */
    gradeId: uuid.optional(),
    learningCorner: z
      .string()
      .trim()
      .min(1, 'no puede estar vacío')
      .max(
        SHARED_ACTIVITY_CORNER_MAX_LENGTH,
        `debe tener como máximo ${SHARED_ACTIVITY_CORNER_MAX_LENGTH} caracteres`,
      )
      .optional(),
    activityType: activityTypeSchema.optional(),
    /** Solo el literal `true`: devuelve únicamente las favoritas de quien consulta. */
    favorites: z
      .literal('true', { error: 'solo admite el valor true' })
      .transform(() => true as const)
      .optional(),
  },
});
/** Filtros de la query tal como llegan; el servicio traduce `favorites` a `favoriteOf`. */
export interface SharedActivityListFilters {
  q?: string;
  levelId?: string;
  areaId?: string;
  authorId?: string;
  gradeId?: string;
  learningCorner?: string;
  activityType?: SharedActivityType;
  favorites?: true;
}

/** Filtros que recibe el repository. */
export interface SharedActivityFilters {
  q?: string;
  levelId?: string;
  areaId?: string;
  authorId?: string;
  /** Lo fija el servicio con el nivel del grado de la query: ese grado y las sin grado del nivel. */
  gradeId?: string;
  gradeLevelId?: string;
  learningCorner?: string;
  activityType?: SharedActivityType;
  /** Lo fija el servicio con el usuario de la sesión; no viene de la query. */
  favoriteOf?: string;
}

export const sharedActivityCornersQuerySchema = z.object({ levelId: uuid.optional() });

/** Rincones distintos en uso, en orden alfabético. */
export const sharedActivityCornersSchema = z.object({
  items: z.array(z.string()).max(SHARED_ACTIVITY_CORNERS_MAX_ITEMS),
});
export type SharedActivityCorners = z.output<typeof sharedActivityCornersSchema>;
