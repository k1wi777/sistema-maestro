import type { LessonPlan } from '@gns/shared';

/** Nombre sugerido del PDF: el navegador lo toma del título del documento al imprimir. */
export function printTitle(plan: Pick<LessonPlan, 'area' | 'topic'>): string {
  return `Planeación – ${plan.area.name} – ${plan.topic?.trim() || 'sin tema'}`;
}
