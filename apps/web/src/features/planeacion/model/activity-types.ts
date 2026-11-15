import { SharedActivityType } from '@gns/shared';

/** `@gns/shared` guarda los valores de la base; las etiquetas visibles viven aquí. */
export const ACTIVITY_TYPE_LABELS: Record<SharedActivityType, string> = {
  [SharedActivityType.Activity]: 'Actividad',
  [SharedActivityType.Game]: 'Juego',
  [SharedActivityType.Project]: 'Proyecto',
  [SharedActivityType.DigitalResource]: 'Recurso digital',
  [SharedActivityType.Video]: 'Video',
};

export const ACTIVITY_TYPE_OPTIONS = Object.values(SharedActivityType).map((value) => ({
  value,
  label: ACTIVITY_TYPE_LABELS[value],
}));
