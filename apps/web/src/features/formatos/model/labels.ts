import { ObserverNoteType } from '@gns/shared';

export {
  JOURNAL_EVENT_INFO,
  JOURNAL_EVENT_ORDER,
  OBSERVER_TYPE_INFO,
  OBSERVER_TYPE_ORDER,
  type LabelInfo,
} from '@/shared/records/format-labels';

/** Tipos II y III exigen seguir la ruta de atención del Manual de Convivencia (Ley 1620 de 2013). */
export function requiresConvivenciaRoute(type: ObserverNoteType | ''): boolean {
  return type === ObserverNoteType.TypeII || type === ObserverNoteType.TypeIII;
}
