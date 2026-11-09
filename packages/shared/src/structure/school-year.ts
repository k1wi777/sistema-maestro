import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { createListQuerySchema, queryBoolean } from '../list-query/list-query';

const SCHOOL_YEAR_FORMAT = /^(\d{4})-(\d{4})$/;

/** Código de año lectivo `AAAA-AAAA` con años consecutivos (p. ej. `2026-2027`). */
export const schoolYearSchema = z
  .string({ error: 'debe ser texto' })
  .trim()
  .superRefine((value, ctx) => {
    const match = SCHOOL_YEAR_FORMAT.exec(value);
    if (!match) {
      ctx.addIssue({ code: 'custom', message: 'debe tener el formato AAAA-AAAA' });
      return;
    }
    if (Number(match[2]) !== Number(match[1]) + 1) {
      ctx.addIssue({ code: 'custom', message: 'debe ser de años consecutivos (p. ej. 2026-2027)' });
    }
  });

/** Año lectivo tal como lo devuelve la API (`vigente` nulo en la base se expone como `false`). */
export const schoolYearEntitySchema = z.object({
  id: z.uuid(),
  code: z.string(),
  isCurrent: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type SchoolYear = z.output<typeof schoolYearEntitySchema>;

export const createSchoolYearSchema = z.object({ code: schoolYearSchema }).strict();
export type CreateSchoolYearInput = z.output<typeof createSchoolYearSchema>;

export const SCHOOL_YEAR_SORT_FIELDS = ['code'] as const;
export type SchoolYearSortField = (typeof SCHOOL_YEAR_SORT_FIELDS)[number];

export const schoolYearListQuerySchema = createListQuerySchema({
  sortFields: SCHOOL_YEAR_SORT_FIELDS,
  defaultSort: { field: 'code', order: 'desc' },
  filters: { isCurrent: queryBoolean.optional() },
});

export interface SchoolYearFilters {
  isCurrent?: boolean;
}
