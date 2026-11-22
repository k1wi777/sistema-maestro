/**
 * Estado del diario de un grupo en una fecha (`diario_campo.estado`). Es propio del diario: lo
 * envía el director(a) de grupo y coordinación no ajusta, así que no reutiliza `RecordStatus`.
 */
export const JournalStatus = {
  InProgress: 'en_curso',
  Submitted: 'enviado',
  ChangesRequested: 'observaciones',
  Reviewed: 'revisado',
  Voided: 'anulado',
} as const;
export type JournalStatus = (typeof JournalStatus)[keyof typeof JournalStatus];

/** Estado de una anotación (`diario_anotacion.estado`); `observada` es «Por corregir». */
export const AnnotationStatus = {
  Draft: 'borrador',
  Ready: 'lista',
  Observed: 'observada',
} as const;
export type AnnotationStatus = (typeof AnnotationStatus)[keyof typeof AnnotationStatus];

/** Aporte de un docente al diario: con anotación lista, solo en borrador o sin nada. */
export const ContributionStatus = {
  Ready: 'ready',
  Draft: 'draft',
  None: 'none',
} as const;
export type ContributionStatus = (typeof ContributionStatus)[keyof typeof ContributionStatus];

/** Hecho del historial del diario (compuesto de datos, nunca de textos de las anotaciones). */
export const JournalHistoryKind = {
  Opened: 'opened',
  Ready: 'ready',
  Submitted: 'submitted',
  Resubmitted: 'resubmitted',
  Returned: 'returned',
  Approved: 'approved',
  Voided: 'voided',
} as const;
export type JournalHistoryKind = (typeof JournalHistoryKind)[keyof typeof JournalHistoryKind];
