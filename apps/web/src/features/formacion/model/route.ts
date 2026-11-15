import {
  TeacherModuleState,
  TrainingActivityType,
  type TeacherModuleSummary,
  type TeacherRoute,
} from '@gns/shared';

import { activityResult, moduleTitleWithNumber } from './labels';

export interface RouteOverview {
  total: number;
  completed: number;
  /** Porcentaje entero de la ruta; 0 si no hay módulos. */
  percent: number;
  /** Primer módulo en curso según el orden de la ruta; `null` si no hay ninguno. */
  continueModule: { id: string; label: string } | null;
  isEmpty: boolean;
}

/** Todos los módulos de la ruta en el orden de la API (inducción primero, luego áreas). */
export function routeModules(route: TeacherRoute): TeacherModuleSummary[] {
  return route.plans.flatMap((plan) => plan.sections.flatMap((section) => section.modules));
}

/** Avance general sumando todos los planes y el módulo para «Continuar donde quedaste». */
export function routeOverview(route: TeacherRoute): RouteOverview {
  const total = route.plans.reduce((sum, plan) => sum + plan.totals.modules, 0);
  const completed = route.plans.reduce((sum, plan) => sum + plan.totals.completed, 0);
  const inProgress = routeModules(route).find(
    (module) => module.state === TeacherModuleState.InProgress,
  );
  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    continueModule: inProgress
      ? { id: inProgress.id, label: moduleTitleWithNumber(inProgress) }
      : null,
    isEmpty: total === 0,
  };
}

export interface ModuleChip {
  key: string;
  label: string;
  /** Marcado en verde: el contenido ya cuenta para terminar el módulo. */
  done: boolean;
}

/**
 * Marcas de contenido de la tarjeta, en el orden de la regla del módulo (video, Desafío,
 * presentación y actividades), solo de lo que el módulo tiene y con su resultado cuando existe.
 */
export function moduleChips(summary: TeacherModuleSummary): ModuleChip[] {
  const chips: ModuleChip[] = [];
  if (summary.steps.video) {
    chips.push({ key: 'video', label: 'Video', done: summary.videoViewedAt !== null });
  }
  if (summary.steps.challenge) {
    chips.push({
      key: 'challenge',
      label: summary.bestScore === null ? 'Desafío GNS' : `Desafío GNS ${summary.bestScore}%`,
      // El resumen no trae el umbral: con el módulo terminado el Desafío ya está aprobado.
      done: summary.completedAt !== null,
    });
  }
  if (summary.steps.presentation) {
    chips.push({
      key: 'presentation',
      label: 'Presentación',
      done: summary.presentationViewedAt !== null,
    });
  }
  for (const activity of summary.activities) {
    const result = activityResult(activity);
    const name =
      activity.type === TrainingActivityType.WheelPassport ? 'Pasaporte' : activity.title;
    chips.push({
      key: activity.id,
      label: result ? `${name} ${result}` : name,
      done: activity.completedAt !== null,
    });
  }
  return chips;
}
