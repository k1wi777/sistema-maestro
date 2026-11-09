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
