import { JournalEventType, ObserverNoteType } from '@gns/shared';

import type { RecordTone } from '@/shared/ui';

export interface LabelInfo {
  label: string;
  tone: RecordTone;
}

/** Tipos de evento del diario de campo con las etiquetas y los tonos del tablero. */
export const JOURNAL_EVENT_INFO: Record<JournalEventType, LabelInfo> = {
  [JournalEventType.Group]: { label: 'Observación del grupo', tone: 'info' },
  [JournalEventType.Positive]: { label: 'Aspecto positivo', tone: 'success' },
  [JournalEventType.ToImprove]: { label: 'Aspecto por mejorar', tone: 'warning' },
};

export const JOURNAL_EVENT_ORDER: readonly JournalEventType[] = [
  JournalEventType.Group,
  JournalEventType.Positive,
  JournalEventType.ToImprove,
];

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
