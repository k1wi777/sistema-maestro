import { RecordStatus } from '@gns/shared';

export type RecordNoun = 'hoja' | 'anotación';

const TEXTS: Record<RecordNoun, { sent: string; done: string; voided: string }> = {
  hoja: {
    sent: 'Enviada: coordinación la está revisando. No se puede editar mientras tanto.',
    done: 'Revisada: coordinación aprobó esta hoja.',
    voided: 'Anulada: ya no se puede editar; coordinación conserva la constancia.',
  },
  anotación: {
    sent: 'Enviada: coordinación la está revisando. No se puede editar mientras tanto.',
    done: 'Revisada: coordinación aprobó esta anotación.',
    voided: 'Anulada: ya no se puede editar; coordinación conserva la constancia.',
  },
};

/** Explicación del solo lectura según el estado; `null` si el registro se puede editar. */
export function readOnlyNotice(
  status: RecordStatus,
  noun: RecordNoun,
): { tone: 'info' | 'success' | 'warning'; text: string } | null {
  const texts = TEXTS[noun];
  switch (status) {
    case RecordStatus.Submitted:
      return { tone: 'info', text: texts.sent };
    case RecordStatus.Reviewed:
      return { tone: 'success', text: texts.done };
    case RecordStatus.Voided:
      return { tone: 'warning', text: texts.voided };
    default:
      return null;
  }
}
