import { lessonPlanAreasLabel, type LessonPlan } from '@gns/shared';

/** Nombre sugerido del PDF: el navegador lo toma del título del documento al imprimir. */
export function printTitle(plan: Pick<LessonPlan, 'areas' | 'topic'>): string {
  return `Planeación – ${lessonPlanAreasLabel(plan.areas)} – ${plan.topic?.trim() || 'sin tema'}`;
}
