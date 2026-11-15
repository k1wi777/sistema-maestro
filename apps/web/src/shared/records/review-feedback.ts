import { ReviewAction, type Review } from '@gns/shared';

export interface LatestDecision {
  decision: typeof ReviewAction.ChangesRequested | typeof ReviewAction.Approved;
  comment: string | null;
  reviewer: string;
  date: Date;
  /** Columnas (claves del historial) que coordinación ajustó junto con esa decisión. */
  adjustedColumns: string[];
}

const isDecision = (review: Review): boolean =>
  review.action === ReviewAction.ChangesRequested || review.action === ReviewAction.Approved;

/**
 * Última decisión de coordinación con su comentario y las columnas que ajustó en ella. Una
 * decisión va acompañada de filas `ajuste` con la misma fecha; cada feature traduce las columnas
 * a sus etiquetas (las desconocidas las ignora).
 */
export function latestDecision(reviews: readonly Review[]): LatestDecision | null {
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
  const columns = new Set<string>();
  for (const review of reviews) {
    if (review.date.getTime() !== time) {
      continue;
    }
    for (const column of review.adjustedFields) {
      columns.add(column);
    }
  }
  return {
    decision: last.action as LatestDecision['decision'],
    comment: last.comment,
    reviewer: last.reviewer.fullName,
    date: last.date,
    adjustedColumns: [...columns],
  };
}
