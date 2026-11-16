import { ReviewAction, type Review } from '@gns/shared';

import { ADJUSTABLE_FIELD_LABELS, FIELD_BY_COLUMN } from '@/shared/records/lesson-plan-fields';

import { blockOfField, type BlockKey } from './plan-blocks';

export type HistoryKind = 'submitted' | 'returned' | 'approved' | 'adjusted';

export interface HistoryLine {
  id: string;
  kind: HistoryKind;
  date: Date;
  /** Quien revisó; `null` en el envío del docente. */
  reviewer: string | null;
  comment: string | null;
  /** Etiquetas de los campos que coordinación ajustó con esa acción. */
  adjusted: string[];
}

const labelOfColumn = (column: string): string | null => {
  const key = FIELD_BY_COLUMN[column];
  return key ? ADJUSTABLE_FIELD_LABELS[key] : null;
};

const unique = (values: readonly string[]): string[] => [...new Set(values)];

/**
 * Historial de revisión de la planeación, del más reciente al más antiguo: cada devolución y
 * aprobación (con los campos que se ajustaron en ella), los ajustes que quedaron sin decisión y,
 * al final de la línea de tiempo, el último envío del docente (la API no guarda cada envío).
 */
export function buildHistory(reviews: readonly Review[], submittedAt: Date | null): HistoryLine[] {
  const decisionTimes = new Set(
    reviews
      .filter((review) => review.action !== ReviewAction.Adjustment)
      .map((review) => review.date.getTime()),
  );
  const adjustedAt = (time: number): string[] =>
    unique(
      reviews
        .filter((review) => review.date.getTime() === time)
        .flatMap((review) => review.adjustedFields)
        .map(labelOfColumn)
        .filter((label): label is string => label !== null),
    );

  const lines: HistoryLine[] = [];
  const adjustmentOnly = new Map<number, Review>();
  for (const review of reviews) {
    const time = review.date.getTime();
    if (review.action === ReviewAction.Adjustment) {
      if (!decisionTimes.has(time) && !adjustmentOnly.has(time)) {
        adjustmentOnly.set(time, review);
      }
      continue;
    }
    lines.push({
      id: review.id,
      kind: review.action === ReviewAction.Approved ? 'approved' : 'returned',
      date: review.date,
      reviewer: review.reviewer.fullName,
      comment: review.comment,
      adjusted: adjustedAt(time),
    });
  }
  for (const [time, review] of adjustmentOnly) {
    lines.push({
      id: review.id,
      kind: 'adjusted',
      date: review.date,
      reviewer: review.reviewer.fullName,
      comment: review.comment,
      adjusted: adjustedAt(time),
    });
  }
  if (submittedAt) {
    lines.push({
      id: 'submitted',
      kind: 'submitted',
      date: submittedAt,
      reviewer: null,
      comment: null,
      adjusted: [],
    });
  }
  return lines.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** Fecha en que coordinación ajustó por última vez cada bloque («Coordinación ajustó»). */
export function adjustedBlockDates(reviews: readonly Review[]): Partial<Record<BlockKey, Date>> {
  const dates: Partial<Record<BlockKey, Date>> = {};
  for (const review of reviews) {
    for (const column of review.adjustedFields) {
      const key = FIELD_BY_COLUMN[column];
      if (!key) {
        continue;
      }
      const block = blockOfField(key);
      const previous = dates[block];
      if (!previous || review.date.getTime() > previous.getTime()) {
        dates[block] = review.date;
      }
    }
  }
  return dates;
}
