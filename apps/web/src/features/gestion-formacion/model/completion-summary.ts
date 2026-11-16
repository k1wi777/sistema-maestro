import type { TrainingModuleDetail } from '@gns/shared';

import { activeActivities, moduleContents } from './editor-steps';

export interface CompletionSummary {
  items: string[];
  /** Sin elementos obligatorios, el docente termina el módulo con su primer avance. */
  firstProgressOnly: boolean;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * «Cómo se termina este módulo», con el contenido guardado: ver el video, aprobar el Desafío con el
 * umbral, revisar la presentación y completar las actividades obligatorias activas. `threshold` es
 * el valor del formulario para reflejarlo mientras se escribe.
 */
export function completionSummary(
  detail: TrainingModuleDetail,
  threshold: number = detail.approvalThreshold,
): CompletionSummary {
  const contents = moduleContents(detail);
  const items: string[] = [];
  if (contents.video) {
    items.push('Ver el video.');
  }
  if (contents.challenge) {
    items.push(`Aprobar el Desafío GNS con ${threshold}% o más.`);
  }
  if (contents.presentation) {
    items.push('Revisar la presentación.');
  }
  const required = activeActivities(detail).filter((activity) => activity.isRequired).length;
  if (required > 0) {
    items.push(
      `Completar ${plural(required, 'actividad obligatoria', 'actividades obligatorias')}.`,
    );
  }
  return { items, firstProgressOnly: items.length === 0 };
}
