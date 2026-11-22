import { ObserverNoteType } from '@gns/shared';

export {
  OBSERVER_TYPE_INFO,
  OBSERVER_TYPE_ORDER,
  type LabelInfo,
} from '@/shared/records/format-labels';

/** Tipos II y III exigen seguir la ruta de atención del Manual de Convivencia (Ley 1620 de 2013). */
export function requiresConvivenciaRoute(type: ObserverNoteType | ''): boolean {
  return type === ObserverNoteType.TypeII || type === ObserverNoteType.TypeIII;
}

/** Notas del formato F-PA-05: el formulario las muestra como ayuda y la hoja impresa las reproduce. */
export const JOURNAL_FORMAT_NOTES = [
  'La descripción del evento debe incluir el estudiante implicado.',
  'Definir las acciones en caso de registrar aspectos por mejorar.',
] as const;
