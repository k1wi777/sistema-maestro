import { AUDIT_UNKNOWN_ROLE, AuditLogType, UserRole } from '@gns/shared';

/** Tipos de movimiento de la bitácora con su rótulo en español, en el orden del tablero. */
export const AUDIT_TYPE_LABELS: Record<AuditLogType, string> = {
  [AuditLogType.Login]: 'Ingreso',
  [AuditLogType.LessonPlan]: 'Planeación',
  [AuditLogType.FieldJournal]: 'Diario de campo',
  [AuditLogType.ObserverNote]: 'Observador',
  [AuditLogType.Training]: 'Plan de formación',
  [AuditLogType.SharedActivity]: 'Repositorio',
  [AuditLogType.Assistant]: 'Asistente',
  [AuditLogType.DataConsent]: 'Datos personales',
  [AuditLogType.Coordination]: 'Coordinación',
  [AuditLogType.Structure]: 'Grados y áreas',
};

/** Roles que registra la bitácora; `desconocido` es una acción sin sesión. */
export const AUDIT_ROLE_LABELS: Record<string, string> = {
  [UserRole.Teacher]: 'Docente',
  [UserRole.Coordinator]: 'Coordinación',
  [UserRole.Administrator]: 'Administración',
  [AUDIT_UNKNOWN_ROLE]: 'Sin sesión',
};

export function auditTypeLabel(type: string): string {
  return (AUDIT_TYPE_LABELS as Record<string, string>)[type] ?? type;
}

export function auditRoleLabel(role: string): string {
  return AUDIT_ROLE_LABELS[role] ?? role;
}
