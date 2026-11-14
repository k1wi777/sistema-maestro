import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { createListQuerySchema } from '../list-query/list-query';
import { UnansweredQuestionStatus } from './unanswered-constants';

const statuses = Object.values(UnansweredQuestionStatus) as [
  UnansweredQuestionStatus,
  ...UnansweredQuestionStatus[],
];

/** Cuántas ocurrencias recientes trae cada pregunta en el listado. */
export const UNANSWERED_LIST_OCCURRENCES = 10;

/**
 * Una vez que alguien hizo la pregunta. Solo el id y el nombre del usuario (personal adulto):
 * nunca correo ni rol, y ningún dato de estudiantes.
 */
export const unansweredOccurrenceSchema = z.object({
  id: z.uuid(),
  user: z.object({ id: z.uuid(), name: z.string() }),
  askedAt: isoDateTimeSchema,
});
export type UnansweredOccurrence = z.output<typeof unansweredOccurrenceSchema>;

/** `text` es nulo cuando la pregunta ya se cerró (atendida o descartada). */
export const unansweredQuestionSchema = z.object({
  id: z.uuid(),
  text: z.string().nullable(),
  times: z.number().int(),
  firstAskedAt: isoDateTimeSchema,
  lastAskedAt: isoDateTimeSchema,
  status: z.enum(statuses),
  faqId: z.uuid().nullable(),
  closedAt: isoDateTimeSchema.nullable(),
  occurrences: z.array(unansweredOccurrenceSchema),
});
export type UnansweredQuestion = z.output<typeof unansweredQuestionSchema>;

export const UNANSWERED_SORT_FIELDS = ['times', 'lastAskedAt'] as const;
export type UnansweredSortField = (typeof UNANSWERED_SORT_FIELDS)[number];

export const unansweredListQuerySchema = createListQuerySchema({
  sortFields: UNANSWERED_SORT_FIELDS,
  defaultSort: { field: 'times', order: 'desc' },
  filters: { status: z.enum(statuses).default(UnansweredQuestionStatus.Pending) },
});

export interface UnansweredFilters {
  status?: UnansweredQuestionStatus;
}
