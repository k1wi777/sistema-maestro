import type { ApiFieldError } from '../api/api-error';

/** Campos que una planeación debe tener para enviarse a coordinación. */
export const LESSON_PLAN_SUBMIT_REQUIRED_FIELDS = [
  'expectedPerformance',
  'developmentMoment',
] as const;
export type LessonPlanSubmitField = (typeof LESSON_PLAN_SUBMIT_REQUIRED_FIELDS)[number];

/** Un campo faltante es vacío o solo espacios. */
export function validateLessonPlanForSubmit(
  plan: Record<LessonPlanSubmitField, string | null | undefined>,
): ApiFieldError[] {
  return LESSON_PLAN_SUBMIT_REQUIRED_FIELDS.filter((field) => !plan[field]?.trim()).map(
    (field) => ({ field, reason: 'es obligatorio para enviar' }),
  );
}
