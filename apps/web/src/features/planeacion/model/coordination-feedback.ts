import type { LessonPlanAdjustableField, Review } from '@gns/shared';

import { latestDecision, type LatestDecision } from '@/shared/records/review-feedback';

import { ADJUSTABLE_FIELD_LABELS, FIELD_BY_COLUMN } from './steps';

export interface CoordinationFeedback extends Omit<LatestDecision, 'adjustedColumns'> {
  /** Campos que coordinación ajustó junto con esa decisión. */
  adjustedFields: LessonPlanAdjustableField[];
}

/**
 * Última decisión de coordinación con su comentario y los campos que ajustó en ella; las columnas
 * del historial se traducen a las claves de la API y las desconocidas se ignoran.
 */
export function latestFeedback(reviews: readonly Review[]): CoordinationFeedback | null {
  const decision = latestDecision(reviews);
  if (!decision) {
    return null;
  }
  const { adjustedColumns, ...rest } = decision;
  const fields = new Set<LessonPlanAdjustableField>();
  for (const column of adjustedColumns) {
    const field = FIELD_BY_COLUMN[column];
    if (field) {
      fields.add(field);
    }
  }
  return { ...rest, adjustedFields: [...fields] };
}

/** «Fecha final, Momento 4 · Cierre» a partir de las claves ajustadas. */
export function adjustedFieldsLabel(fields: readonly LessonPlanAdjustableField[]): string {
  return fields.map((field) => ADJUSTABLE_FIELD_LABELS[field]).join(', ');
}
