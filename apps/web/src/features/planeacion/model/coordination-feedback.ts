import { ReviewAction, type LessonPlanAdjustableField, type Review } from '@gns/shared';

import { ADJUSTABLE_FIELD_LABELS, FIELD_BY_COLUMN } from './steps';

export interface CoordinationFeedback {
  decision: typeof ReviewAction.ChangesRequested | typeof ReviewAction.Approved;
  comment: string | null;
  reviewer: string;
  date: Date;
  /** Campos que coordinación ajustó junto con esa decisión. */
  adjustedFields: LessonPlanAdjustableField[];
}

const isDecision = (review: Review): boolean =>
  review.action === ReviewAction.ChangesRequested || review.action === ReviewAction.Approved;

/**
 * Última decisión de coordinación con su comentario y los campos que ajustó en ella. Una decisión
 * va acompañada de filas `ajuste` con la misma fecha; las columnas del historial se traducen a las
 * claves de la API y las desconocidas se ignoran.
 */
export function latestFeedback(reviews: readonly Review[]): CoordinationFeedback | null {
  let last: Review | null = null;
  for (const review of reviews) {
    if (isDecision(review) && (!last || review.date.getTime() >= last.date.getTime())) {
      last = review;
    }
  }
  if (!last) {
    return null;
  }
  const time = last.date.getTime();
  const fields = new Set<LessonPlanAdjustableField>();
  for (const review of reviews) {
    if (review.date.getTime() !== time) {
      continue;
    }
    for (const column of review.adjustedFields) {
      const field = FIELD_BY_COLUMN[column];
      if (field) {
        fields.add(field);
      }
    }
  }
  return {
    decision: last.action as CoordinationFeedback['decision'],
    comment: last.comment,
    reviewer: last.reviewer.fullName,
    date: last.date,
    adjustedFields: [...fields],
  };
}

/** «Fecha final, Momento 4 · Cierre» a partir de las claves ajustadas. */
export function adjustedFieldsLabel(fields: readonly LessonPlanAdjustableField[]): string {
  return fields.map((field) => ADJUSTABLE_FIELD_LABELS[field]).join(', ');
}
