import { RecordActor, RecordOperation, RecordStatus, canTransition } from '@gns/shared';

import type { StatusTone } from '@/shared/ui';

export interface StatusInfo {
  /** Texto de la etiqueta del estado en tarjetas y encabezados. */
  label: string;
  tone: StatusTone;
  /** Texto del filtro por estado (plural). */
  filterLabel: string;
}

export const STATUS_INFO: Record<RecordStatus, StatusInfo> = {
  [RecordStatus.Draft]: { label: 'Borrador', tone: 'neutral', filterLabel: 'Borradores' },
  [RecordStatus.Submitted]: {
    label: 'Enviada · pendiente de revisión',
    tone: 'info',
    filterLabel: 'Enviadas',
  },
  [RecordStatus.ChangesRequested]: {
    label: 'Con observaciones',
    tone: 'warning',
    filterLabel: 'Con observaciones',
  },
  [RecordStatus.Reviewed]: { label: 'Revisada', tone: 'success', filterLabel: 'Revisadas' },
  [RecordStatus.Voided]: { label: 'Anulada', tone: 'danger', filterLabel: 'Anuladas' },
};

/** Estados en el orden de los filtros de la lista. */
export const STATUS_ORDER: readonly RecordStatus[] = [
  RecordStatus.Draft,
  RecordStatus.Submitted,
  RecordStatus.ChangesRequested,
  RecordStatus.Reviewed,
  RecordStatus.Voided,
];

/** El dueño solo edita en borrador y con observaciones (misma regla que la API). */
export function isEditable(status: RecordStatus): boolean {
  return canTransition(RecordOperation.Edit, RecordActor.Owner, status);
}

/** El dueño puede anular su planeación en borrador, enviada o con observaciones. */
export function canVoid(status: RecordStatus): boolean {
  return canTransition(RecordOperation.Void, RecordActor.Owner, status);
}

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
