import { RecordStatus } from '@gns/shared';

/** Explicación del solo lectura según el estado; `null` si la planeación se puede editar. */
export function readOnlyNotice(
  status: RecordStatus,
): { tone: 'info' | 'success' | 'warning'; text: string } | null {
  switch (status) {
    case RecordStatus.Submitted:
      return {
        tone: 'info',
        text: 'Enviada: coordinación la está revisando. No se puede editar mientras tanto.',
      };
    case RecordStatus.Reviewed:
      return { tone: 'success', text: 'Revisada: coordinación aprobó esta planeación.' };
    case RecordStatus.Voided:
      return {
        tone: 'warning',
        text: 'Anulada: ya no se puede editar; coordinación conserva la constancia.',
      };
    default:
      return null;
  }
}
