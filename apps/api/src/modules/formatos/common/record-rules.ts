import { RecordStatus } from '@gns/shared';

// La regla de quién consulta y quién revisa vive en `shared/records/review-scope.ts`.

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
