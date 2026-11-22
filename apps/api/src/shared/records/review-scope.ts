import { RecordActor, UserRole } from '@gns/shared';
import type { RequestUser } from '../../core/audit/request-user';

/**
 * Alcance de la revisión de registros pedagógicos (planeaciones, diarios y observador).
 * Consultar y decidir son cosas distintas: coordinación y administración consultan todo el
 * colegio, pero solo decide la coordinadora del grado. No hay jerarquía entre roles.
 */

/** Coordinación o administración: puede consultar los registros de todo el colegio. */
export const isStaff = (user: RequestUser): boolean =>
  user.role === UserRole.Coordinator || user.role === UserRole.Administrator;

/**
 * Solo la coordinadora del grado revisa (aprueba, devuelve, observa o anula como revisora).
 * Un grado sin coordinadora (`null`) no lo revisa nadie, ni siquiera administración.
 */
export const canReviewGrade = (user: RequestUser, coordinatorId: string | null): boolean =>
  user.role === UserRole.Coordinator && coordinatorId !== null && coordinatorId === user.id;

/** Papeles con los que `user` actúa sobre un registro: dueño y/o coordinadora del grado. */
export function actorsOf(
  user: RequestUser,
  ownerId: string,
  coordinatorId: string | null,
): RecordActor[] {
  return [
    ...(ownerId === user.id ? [RecordActor.Owner] : []),
    ...(canReviewGrade(user, coordinatorId) ? [RecordActor.Reviewer] : []),
  ];
}

/** Mensaje de 403 cuando el registro no es de un grado de la coordinadora. */
export const OUT_OF_SCOPE_MESSAGE = 'Ese registro no es de un grado que coordines';
