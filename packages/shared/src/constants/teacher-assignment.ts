import { UserRole } from './user';

/** Estado de una asignación docente (`asignacion_docente.estado`). */
export const TeacherAssignmentStatus = {
  Active: 'activa',
  Withdrawn: 'retirada',
} as const;
export type TeacherAssignmentStatus =
  (typeof TeacherAssignmentStatus)[keyof typeof TeacherAssignmentStatus];

/**
 * Roles que pueden recibir asignaciones: el coordinador también dicta clase; el
 * administrador es la cuenta responsable de la plataforma y no recibe asignaciones.
 */
export const ASSIGNABLE_ROLES: readonly UserRole[] = [UserRole.Teacher, UserRole.Coordinator];
