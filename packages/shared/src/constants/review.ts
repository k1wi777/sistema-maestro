import { RecordStatus } from './record-status';

/** Tipo de registro revisado por coordinación (`revision.tipo_registro`). */
export const ReviewRecordType = {
  LessonPlan: 'planeacion',
  FieldJournal: 'diario',
  ObserverNote: 'observador',
} as const;
export type ReviewRecordType = (typeof ReviewRecordType)[keyof typeof ReviewRecordType];

/** Acción de coordinación sobre un registro (`revision.accion`). */
export const ReviewAction = {
  Adjustment: 'ajuste',
  ChangesRequested: 'observaciones',
  Approved: 'aprobada',
} as const;
export type ReviewAction = (typeof ReviewAction)[keyof typeof ReviewAction];

/** Decisión de coordinación sobre un registro enviado: las acciones que cierran la revisión. */
export const ReviewDecision = {
  ChangesRequested: ReviewAction.ChangesRequested,
  Approved: ReviewAction.Approved,
} as const;
export type ReviewDecision = (typeof ReviewDecision)[keyof typeof ReviewDecision];

/**
 * Estado en que queda un registro según la decisión. `ajuste` no determina estado: va
 * siempre seguido de una decisión.
 */
export const REVIEW_DECISION_RESULT_STATUS: Record<ReviewDecision, RecordStatus> = {
  [ReviewDecision.Approved]: RecordStatus.Reviewed,
  [ReviewDecision.ChangesRequested]: RecordStatus.ChangesRequested,
};
