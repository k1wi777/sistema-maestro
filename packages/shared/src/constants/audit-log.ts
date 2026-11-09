/** Tipo de acción registrada en la bitácora (`bitacora.tipo`). */
export const AuditLogType = {
  Login: 'ingreso',
  LessonPlan: 'planeacion',
  FieldJournal: 'diario',
  ObserverNote: 'observador',
  Training: 'formacion',
  SharedActivity: 'repositorio',
  Assistant: 'asistente',
  DataConsent: 'datos',
  Coordination: 'coordinacion',
} as const;
export type AuditLogType = (typeof AuditLogType)[keyof typeof AuditLogType];

/** Rol que se registra en la bitácora cuando la acción no tiene sesión (`bitacora.rol`). */
export const AUDIT_UNKNOWN_ROLE = 'desconocido';
