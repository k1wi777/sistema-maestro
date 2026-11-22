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
  Structure: 'estructura',
  /** Usuarios y roles: alta, edición, cambio de rol, estado y contraseña (solo administración). */
  Users: 'usuarios',
} as const;
export type AuditLogType = (typeof AuditLogType)[keyof typeof AuditLogType];

/** Rol que se registra en la bitácora cuando la acción no tiene sesión (`bitacora.rol`). */
export const AUDIT_UNKNOWN_ROLE = 'desconocido';
