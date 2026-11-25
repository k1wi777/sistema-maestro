import type {
  PlanTracking,
  TrainingModuleOutline,
  TrainingPlanTree,
  TrainingSectionWithModules,
} from '@gns/shared';

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Resumen de contenidos de un módulo en la lista. El árbol solo trae conteos: el video y el archivo
 * de la presentación se ven en el editor.
 */
export function contentSummary(
  module: Pick<TrainingModuleOutline, 'slideCount' | 'questionCount' | 'activityCount'>,
): string {
  const parts: string[] = [];
  if (module.questionCount > 0) {
    parts.push(`Desafío (${plural(module.questionCount, 'pregunta', 'preguntas')})`);
  }
  if (module.slideCount > 0) {
    parts.push(`Presentación (${plural(module.slideCount, 'diapositiva', 'diapositivas')})`);
  }
  if (module.activityCount > 0) {
    parts.push(plural(module.activityCount, 'actividad', 'actividades'));
  }
  return parts.length > 0 ? parts.join(' · ') : 'Sin contenidos todavía';
}

/** «4 terminados · 1 en curso · de 6 docentes», con los totales del seguimiento. */
export function trackingText(
  totals: { inProgress: number; done: number },
  teacherCount: number,
): string {
  return [
    plural(totals.done, 'terminado', 'terminados'),
    `${totals.inProgress} en curso`,
    `de ${plural(teacherCount, 'docente', 'docentes')}`,
  ].join(' · ');
}

/** Totales del seguimiento de un módulo por id (solo los publicados tienen entrada). */
export function trackingByModule(
  tracking: PlanTracking | null,
): Map<string, { inProgress: number; done: number }> {
  const totals = new Map<string, { inProgress: number; done: number }>();
  for (const tracked of tracking?.modules ?? []) {
    totals.set(tracked.id, tracked.totals);
  }
  return totals;
}

export interface ModuleGroup {
  section: Pick<TrainingSectionWithModules, 'id' | 'title' | 'subtitle'>;
  modules: TrainingModuleOutline[];
}

/**
 * Las secciones de un plan en el orden de la API, todas: también las vacías y las de los planes de
 * área, porque coordinación crea módulos desde cada una. Un plan sin secciones da una lista vacía.
 */
export function moduleGroups(tree: TrainingPlanTree): ModuleGroup[] {
  return tree.sections.map((section) => ({ section, modules: section.modules }));
}
