import { RecordActor, RecordStatus, roleSatisfies, UserRole } from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';

/** Coordinación: rol coordinador o superior (incluye administración). */
export const isReviewer = (user: RequestUser): boolean =>
  roleSatisfies(user.role, UserRole.Coordinator);

/** Papeles con los que `user` actúa sobre un registro: dueño y/o coordinación. */
export function actorsOf(user: RequestUser, ownerId: string): RecordActor[] {
  return [
    ...(ownerId === user.id ? [RecordActor.Owner] : []),
    ...(isReviewer(user) ? [RecordActor.Reviewer] : []),
  ];
}

/** Cómo se nombra cada estado en los mensajes de conflicto («la hoja», «la anotación»: femenino). */
export const STATUS_LABEL: Record<RecordStatus, string> = {
  [RecordStatus.Draft]: 'en borrador',
  [RecordStatus.Submitted]: 'enviada',
  [RecordStatus.ChangesRequested]: 'devuelta con observaciones',
  [RecordStatus.Reviewed]: 'revisada',
  [RecordStatus.Voided]: 'anulada',
};

/** Mensaje de 409 al anular: una revisada solo la anula coordinación. */
export function voidConflictMessage(noun: 'hoja' | 'anotación', status: RecordStatus): string {
  const article = noun === 'hoja' ? 'La hoja' : 'La anotación';
  return status === RecordStatus.Reviewed
    ? `${article} está revisada: solo coordinación puede anularla`
    : `${article} está ${STATUS_LABEL[status]} y no se puede anular`;
}
