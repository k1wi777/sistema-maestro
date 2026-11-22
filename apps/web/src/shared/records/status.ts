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

/** El dueño anula lo ya enviado: enviada o con observaciones (un borrador se descarta). */
export function canVoid(status: RecordStatus): boolean {
  return canTransition(RecordOperation.Void, RecordActor.Owner, status);
}

/** El dueño descarta (borrado real) solo un borrador que nunca se envió. */
export function canDiscard(status: RecordStatus): boolean {
  return canTransition(RecordOperation.Discard, RecordActor.Owner, status);
}
