import { ObserverNoteType } from '@gns/shared';

import type { RecordTone } from '@/shared/ui';

export interface LabelInfo {
  label: string;
  tone: RecordTone;
}

/** Tipos de anotación del observador con las etiquetas del tablero. */
export const OBSERVER_TYPE_INFO: Record<ObserverNoteType, LabelInfo> = {
  [ObserverNoteType.Positive]: { label: 'Reconocimiento positivo', tone: 'success' },
  [ObserverNoteType.Academic]: { label: 'Desempeño académico', tone: 'info' },
  [ObserverNoteType.TypeI]: { label: 'Situación de convivencia Tipo I', tone: 'neutral' },
  [ObserverNoteType.TypeII]: { label: 'Situación de convivencia Tipo II', tone: 'warning' },
  [ObserverNoteType.TypeIII]: { label: 'Situación de convivencia Tipo III', tone: 'danger' },
  [ObserverNoteType.Other]: { label: 'Otra observación', tone: 'neutral' },
};

/** Orden del selector del formulario. */
export const OBSERVER_TYPE_ORDER: readonly ObserverNoteType[] = [
  ObserverNoteType.Positive,
  ObserverNoteType.Academic,
  ObserverNoteType.TypeI,
  ObserverNoteType.TypeII,
  ObserverNoteType.TypeIII,
  ObserverNoteType.Other,
];
