import { AnnotationStatus, JournalStatus } from '@gns/shared';

import type { StatusTone } from '@/shared/ui';

export interface JournalStatusInfo {
  /** Texto de la etiqueta del estado en tarjetas y encabezados. */
  label: string;
  /** Texto en la bandeja de coordinación (el diario enviado «espera revisión»). */
  shortLabel: string;
  tone: StatusTone;
  /** Texto del filtro por estado (plural). */
  filterLabel: string;
}

/** Estados del diario por grupo y día: propios, distintos de los de planeación y observador. */
export const JOURNAL_STATUS_INFO: Record<JournalStatus, JournalStatusInfo> = {
  [JournalStatus.InProgress]: {
    label: 'En curso',
    shortLabel: 'En curso',
    tone: 'neutral',
    filterLabel: 'En curso',
  },
  [JournalStatus.Submitted]: {
    label: 'Enviado · pendiente de revisión',
    shortLabel: 'Pendiente de revisión',
    tone: 'info',
    filterLabel: 'Enviados',
  },
  [JournalStatus.ChangesRequested]: {
    label: 'Con observaciones',
    shortLabel: 'Con observaciones',
    tone: 'warning',
    filterLabel: 'Con observaciones',
  },
  [JournalStatus.Reviewed]: {
    label: 'Revisado',
    shortLabel: 'Revisado',
    tone: 'success',
    filterLabel: 'Revisados',
  },
  [JournalStatus.Voided]: {
    label: 'Anulado',
    shortLabel: 'Anulado',
    tone: 'danger',
    filterLabel: 'Anulados',
  },
};

/** Estados en el orden de los filtros. */
export const JOURNAL_STATUS_ORDER: readonly JournalStatus[] = [
  JournalStatus.InProgress,
  JournalStatus.Submitted,
  JournalStatus.ChangesRequested,
  JournalStatus.Reviewed,
  JournalStatus.Voided,
];

/** Estado elegido en la URL (`?estado=`): solo se acepta uno de los cinco conocidos. */
export function journalStatusFromUrl(value: string | null): JournalStatus | undefined {
  return JOURNAL_STATUS_ORDER.find((status) => status === value);
}

export const ANNOTATION_STATUS_INFO: Record<AnnotationStatus, { label: string; tone: StatusTone }> =
  {
    [AnnotationStatus.Draft]: { label: 'Borrador', tone: 'neutral' },
    [AnnotationStatus.Ready]: { label: 'Lista', tone: 'success' },
    [AnnotationStatus.Observed]: { label: 'Por corregir', tone: 'warning' },
  };
