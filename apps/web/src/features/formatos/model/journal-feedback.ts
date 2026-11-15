import { RecordStatus, parseJournalEntryChangeField, type Review } from '@gns/shared';

import { latestDecision, type LatestDecision } from '@/shared/records/review-feedback';

export interface JournalFeedback {
  decision: LatestDecision | null;
  /** Registros (ids) que coordinación ajustó junto con esa decisión. */
  adjustedEntryIds: string[];
}

/**
 * Última decisión de coordinación y los registros que ajustó en ella: las columnas ajustadas del
 * diario llegan como `entradas.<id>.<columna>`; las que no son de un registro se ignoran.
 */
export function journalFeedback(reviews: readonly Review[]): JournalFeedback {
  const decision = latestDecision(reviews);
  const ids = new Set<string>();
  for (const column of decision?.adjustedColumns ?? []) {
    const parsed = parseJournalEntryChangeField(column);
    if (parsed) {
      ids.add(parsed.entryId);
    }
  }
  return { decision, adjustedEntryIds: [...ids] };
}

/** «Coordinación ajustó 2 registros»; `null` si no ajustó ninguno. */
export function adjustedEntriesLabel(count: number): string | null {
  if (count <= 0) {
    return null;
  }
  return `Coordinación ajustó ${count} ${count === 1 ? 'registro' : 'registros'}`;
}

/** Texto de la hoja enviada que aún no revisa coordinación (también va en el PDF). */
export const JOURNAL_PENDING_REVIEW = 'Pendiente de revisión por coordinación';

export type JournalReviewLine =
  { kind: 'decision'; decision: LatestDecision } | { kind: 'text'; text: string };

/**
 * Qué dice la sección «Revisión» según el estado: la decisión solo se muestra mientras sigue
 * vigente (revisada o devuelta con observaciones); una hoja reenviada vuelve a estar pendiente.
 */
export function journalReviewLine(
  status: RecordStatus,
  feedback: JournalFeedback,
): JournalReviewLine {
  const current =
    status === RecordStatus.Reviewed || status === RecordStatus.ChangesRequested
      ? feedback.decision
      : null;
  if (current) {
    return { kind: 'decision', decision: current };
  }
  switch (status) {
    case RecordStatus.Draft:
      return { kind: 'text', text: 'Sin enviar a coordinación' };
    case RecordStatus.Voided:
      return { kind: 'text', text: 'Hoja anulada: no tiene revisión' };
    default:
      return { kind: 'text', text: JOURNAL_PENDING_REVIEW };
  }
}
