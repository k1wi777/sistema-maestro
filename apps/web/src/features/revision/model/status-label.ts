import { RecordStatus } from '@gns/shared';

const LABELS: Record<RecordStatus, string> = {
  [RecordStatus.Draft]: 'Borrador',
  [RecordStatus.Submitted]: 'Pendiente de revisión',
  [RecordStatus.ChangesRequested]: 'Con observaciones',
  [RecordStatus.Reviewed]: 'Revisada',
  [RecordStatus.Voided]: 'Anulada',
};

/**
 * Etiqueta corta del estado para las tablas de coordinación («Pendiente de revisión» en vez de
 * «Enviada · pendiente de revisión»): la tabla ya es angosta y desde aquí la enviada es la tarea.
 */
export function shortStatusLabel(status: RecordStatus): string {
  return LABELS[status];
}
