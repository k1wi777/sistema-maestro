import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { createListQuerySchema, queryBoolean } from '../list-query/list-query';

/** Categorías del asistente (las del seed y las del prototipo); el esquema valida el texto. */
export const FAQ_CATEGORIES = [
  'Convivencia',
  'Talento humano y beneficios',
  'Institucional',
  'Uso de la plataforma',
] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

// Longitudes de las columnas de `pregunta_frecuente`; la respuesta (TEXT) se acota a 4000.
export const FAQ_QUESTION_MAX_LENGTH = 200;
export const FAQ_ANSWER_MAX_LENGTH = 4000;
export const FAQ_KEYWORDS_MAX_LENGTH = 500;
export const FAQ_SOURCE_MAX_LENGTH = 120;

const requiredText = (max: number) =>
  z
    .string({ error: 'debe ser texto' })
    .trim()
    .min(1, 'no puede estar vacío')
    .max(max, `no puede superar ${max} caracteres`);

const category = z.enum(FAQ_CATEGORIES, { error: 'no es una categoría del asistente' });

export const createFaqSchema = z.strictObject({
  category,
  question: requiredText(FAQ_QUESTION_MAX_LENGTH),
  answer: requiredText(FAQ_ANSWER_MAX_LENGTH),
  keywords: requiredText(FAQ_KEYWORDS_MAX_LENGTH).optional(),
  source: requiredText(FAQ_SOURCE_MAX_LENGTH).optional(),
  isActive: z.boolean({ error: 'debe ser verdadero o falso' }).default(true),
  /** Pregunta sin respuesta pendiente que esta pregunta frecuente atiende. */
  unansweredQuestionId: z.uuid({ error: 'debe ser un UUID' }).optional(),
});
export type CreateFaqInput = z.output<typeof createFaqSchema>;

/** Edición parcial: solo se actualizan los campos enviados; al menos uno. */
export const updateFaqSchema = z
  .strictObject({
    category: category.optional(),
    question: requiredText(FAQ_QUESTION_MAX_LENGTH).optional(),
    answer: requiredText(FAQ_ANSWER_MAX_LENGTH).optional(),
    keywords: requiredText(FAQ_KEYWORDS_MAX_LENGTH).optional(),
    source: requiredText(FAQ_SOURCE_MAX_LENGTH).optional(),
    isActive: z.boolean({ error: 'debe ser verdadero o falso' }).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'debe enviar al menos un campo',
  });
export type UpdateFaqInput = z.output<typeof updateFaqSchema>;

/** Lo que ve cualquier rol: sin palabras clave ni quién la editó. */
export const faqViewSchema = z.object({
  id: z.uuid(),
  category: z.string(),
  question: z.string(),
  answer: z.string(),
  source: z.string().nullable(),
});
export type FaqView = z.output<typeof faqViewSchema>;

export const faqListSchema = z.object({ items: z.array(faqViewSchema) });
export type FaqList = z.output<typeof faqListSchema>;

/** Lo que ve coordinación para gestionar. */
export const faqAdminViewSchema = faqViewSchema.extend({
  keywords: z.string().nullable(),
  isActive: z.boolean(),
  updatedById: z.uuid().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type FaqAdminView = z.output<typeof faqAdminViewSchema>;

export const FAQ_SORT_FIELDS = ['category', 'question', 'updatedAt'] as const;
export type FaqSortField = (typeof FAQ_SORT_FIELDS)[number];

export const faqListQuerySchema = createListQuerySchema({
  sortFields: FAQ_SORT_FIELDS,
  defaultSort: { field: 'category', order: 'asc' },
  filters: { isActive: queryBoolean.optional(), category: category.optional() },
});

export interface FaqFilters {
  isActive?: boolean;
  category?: FaqCategory;
}
