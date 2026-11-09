import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { AreaType } from '../constants/area';
import { createListQuerySchema } from '../list-query/list-query';
import { schoolYearSchema } from './school-year';

export const LEVEL_NAME_MAX_LENGTH = 60;
export const GRADE_NAME_MAX_LENGTH = 40;
export const AREA_NAME_MAX_LENGTH = 80;
export const MAX_SORT_ORDER = 32767;
export const ACADEMIC_PERIODS_PER_YEAR = 3;

const nameSchema = (maxLength: number) =>
  z
    .string({ error: 'debe ser texto' })
    .trim()
    .min(1, 'no puede estar vacío')
    .max(maxLength, `debe tener como máximo ${maxLength} caracteres`);

// `orden` es SmallInt en la base.
const sortOrderSchema = z
  .number({ error: 'debe ser un número' })
  .int('debe ser un entero')
  .min(1, 'debe ser al menos 1')
  .max(MAX_SORT_ORDER, `debe ser como máximo ${MAX_SORT_ORDER}`);

const areaTypeSchema = z.enum(Object.values(AreaType) as [AreaType, ...AreaType[]], {
  error: 'tipo no permitido',
});

const calendarDateSchema = z.iso.date({ error: 'debe ser una fecha AAAA-MM-DD' });

const timestamps = { createdAt: isoDateTimeSchema, updatedAt: isoDateTimeSchema };

/** Un PATCH vacío no debe reponer valores: los esquemas parciales no llevan defaults. */
const atLeastOneField = { error: 'debe incluir al menos un campo' };

// ---------- Niveles ----------

export const levelSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  sortOrder: z.number().int(),
  ...timestamps,
});
export type Level = z.output<typeof levelSchema>;

export const createLevelSchema = z
  .object({ name: nameSchema(LEVEL_NAME_MAX_LENGTH), sortOrder: sortOrderSchema })
  .strict();
export type CreateLevelInput = z.output<typeof createLevelSchema>;

export const updateLevelSchema = createLevelSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, atLeastOneField);
export type UpdateLevelInput = z.output<typeof updateLevelSchema>;

export const LEVEL_SORT_FIELDS = ['sortOrder', 'name'] as const;
export type LevelSortField = (typeof LEVEL_SORT_FIELDS)[number];
export const levelListQuerySchema = createListQuerySchema({
  sortFields: LEVEL_SORT_FIELDS,
  defaultSort: { field: 'sortOrder', order: 'asc' },
});
export type LevelFilters = Record<never, never>;

// ---------- Grados ----------

export const gradeSchema = z.object({
  id: z.uuid(),
  levelId: z.uuid(),
  name: z.string(),
  sortOrder: z.number().int(),
  ...timestamps,
});
export type Grade = z.output<typeof gradeSchema>;

export const createGradeSchema = z
  .object({
    name: nameSchema(GRADE_NAME_MAX_LENGTH),
    levelId: z.uuid({ error: 'debe ser un UUID' }),
    sortOrder: sortOrderSchema,
  })
  .strict();
export type CreateGradeInput = z.output<typeof createGradeSchema>;

export const updateGradeSchema = createGradeSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, atLeastOneField);
export type UpdateGradeInput = z.output<typeof updateGradeSchema>;

export const GRADE_SORT_FIELDS = ['sortOrder', 'name'] as const;
export type GradeSortField = (typeof GRADE_SORT_FIELDS)[number];
export const gradeListQuerySchema = createListQuerySchema({
  sortFields: GRADE_SORT_FIELDS,
  defaultSort: { field: 'sortOrder', order: 'asc' },
  filters: { levelId: z.uuid({ error: 'debe ser un UUID' }).optional() },
});
export interface GradeFilters {
  levelId?: string;
}

// ---------- Áreas ----------

export const areaSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: areaTypeSchema,
  ...timestamps,
});
export type Area = z.output<typeof areaSchema>;

export const createAreaSchema = z
  .object({ name: nameSchema(AREA_NAME_MAX_LENGTH), type: areaTypeSchema })
  .strict();
export type CreateAreaInput = z.output<typeof createAreaSchema>;

export const updateAreaSchema = createAreaSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, atLeastOneField);
export type UpdateAreaInput = z.output<typeof updateAreaSchema>;

export const AREA_SORT_FIELDS = ['name', 'type'] as const;
export type AreaSortField = (typeof AREA_SORT_FIELDS)[number];
export const areaListQuerySchema = createListQuerySchema({
  sortFields: AREA_SORT_FIELDS,
  defaultSort: { field: 'name', order: 'asc' },
  filters: { type: areaTypeSchema.optional() },
});
export interface AreaFilters {
  type?: AreaType;
}

// ---------- Periodos académicos ----------

export const academicPeriodSchema = z.object({
  id: z.uuid(),
  schoolYear: z.string(),
  number: z.number().int(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  ...timestamps,
});
export type AcademicPeriod = z.output<typeof academicPeriodSchema>;

interface OptionalPeriodDates {
  startDate?: string | null;
  endDate?: string | null;
}

/** Las fechas `AAAA-MM-DD` se comparan como texto. */
export function periodDatesOrdered({ startDate, endDate }: OptionalPeriodDates): boolean {
  return !startDate || !endDate || startDate <= endDate;
}
const periodDatesIssue = {
  error: 'la fecha de inicio no puede ser posterior a la de fin',
  path: ['startDate'],
};

export const createAcademicPeriodSchema = z
  .object({
    schoolYear: schoolYearSchema,
    number: z
      .number({ error: 'debe ser un número' })
      .int('debe ser un entero')
      .min(1, 'debe ser de 1 a 3')
      .max(ACADEMIC_PERIODS_PER_YEAR, 'debe ser de 1 a 3'),
    startDate: calendarDateSchema.optional(),
    endDate: calendarDateSchema.optional(),
  })
  .strict()
  .refine(periodDatesOrdered, periodDatesIssue);
export type CreateAcademicPeriodInput = z.output<typeof createAcademicPeriodSchema>;

/** Solo las fechas son editables: el año y el número identifican al periodo. */
export const updateAcademicPeriodSchema = z
  .object({ startDate: calendarDateSchema.nullable(), endDate: calendarDateSchema.nullable() })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, atLeastOneField)
  .refine(periodDatesOrdered, periodDatesIssue);
export type UpdateAcademicPeriodInput = z.output<typeof updateAcademicPeriodSchema>;

export const ACADEMIC_PERIOD_SORT_FIELDS = ['schoolYear', 'number'] as const;
export type AcademicPeriodSortField = (typeof ACADEMIC_PERIOD_SORT_FIELDS)[number];
export const academicPeriodListQuerySchema = createListQuerySchema({
  sortFields: ACADEMIC_PERIOD_SORT_FIELDS,
  defaultSort: { field: 'schoolYear', order: 'desc' },
  filters: { schoolYear: schoolYearSchema.optional() },
});
export interface AcademicPeriodFilters {
  schoolYear?: string;
}
