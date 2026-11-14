import { z } from 'zod';
import { faqViewSchema } from './faq';
import {
  ASSISTANT_QUESTION_MIN_LENGTH,
  UNANSWERED_QUESTION_TEXT_MAX_LENGTH,
} from './unanswered-constants';

/** Consulta al asistente: entre 2 y 200 caracteres una vez recortados los espacios. */
export const assistantQuerySchema = z.strictObject({
  question: z
    .string({ error: 'debe ser texto' })
    .trim()
    .min(
      ASSISTANT_QUESTION_MIN_LENGTH,
      `debe tener al menos ${ASSISTANT_QUESTION_MIN_LENGTH} caracteres`,
    )
    .max(
      UNANSWERED_QUESTION_TEXT_MAX_LENGTH,
      `no puede superar ${UNANSWERED_QUESTION_TEXT_MAX_LENGTH} caracteres`,
    ),
});
export type AssistantQueryInput = z.output<typeof assistantQuerySchema>;

/** Pregunta relacionada o sugerida: solo lo necesario para mostrarla. */
export const assistantSuggestionSchema = z.object({
  id: z.uuid(),
  category: z.string(),
  question: z.string(),
});
export type AssistantSuggestion = z.output<typeof assistantSuggestionSchema>;

export const assistantAnswerSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('answered'),
    faq: faqViewSchema,
    related: z.array(assistantSuggestionSchema),
  }),
  z.object({
    status: z.literal('unanswered'),
    suggestions: z.array(assistantSuggestionSchema),
  }),
]);
export type AssistantAnswer = z.output<typeof assistantAnswerSchema>;
