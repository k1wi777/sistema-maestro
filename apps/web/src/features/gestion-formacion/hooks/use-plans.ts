'use client';

import type {
  CreateTrainingModuleInput,
  PlanTracking,
  TrainingPlanSummary,
  TrainingPlanTree,
} from '@gns/shared';
import { useCallback, useState } from 'react';

import type { ApiError, ApiResult } from '@/shared/api';
import { useRemote, type Remote } from '@/shared/data';

import { listAreas, type CatalogArea } from '../api/catalogs';
import {
  changeModuleStatus,
  createModule,
  createPlan,
  createSection,
  getPlanTree,
  listPlans,
  type ModuleStatusAction,
} from '../api/plans';
import { getPlanTracking } from '../api/tracking';
import type { PlanOption } from '../model/plan-catalog';

/** Nombre de la parte única que se crea con el plan de un área. */
export const AREA_SECTION_TITLE = 'Módulos del área';

export interface PlansCatalog {
  plans: TrainingPlanSummary[];
  areas: CatalogArea[];
}

async function loadCatalog(): Promise<ApiResult<PlansCatalog>> {
  const [plans, areas] = await Promise.all([listPlans(), listAreas()]);
  if (!plans.ok) {
    return plans;
  }
  if (!areas.ok) {
    return areas;
  }
  return { ok: true, data: { plans: plans.data, areas: areas.data } };
}

/** Planes y áreas para el selector. */
export function usePlansCatalog(): Remote<PlansCatalog> {
  return useRemote(loadCatalog, 'gestion-formacion:catalog');
}

export interface PlanView {
  tree: TrainingPlanTree;
  /** `null` si el seguimiento no pudo cargarse: la lista se muestra sin totales. */
  tracking: PlanTracking | null;
  trackingError: ApiError | null;
}

async function loadPlanView(planId: string): Promise<ApiResult<PlanView | null>> {
  const [tree, tracking] = await Promise.all([getPlanTree(planId), getPlanTracking(planId)]);
  if (!tree.ok) {
    return tree;
  }
  return {
    ok: true,
    data: {
      tree: tree.data,
      tracking: tracking.ok ? tracking.data : null,
      trackingError: tracking.ok ? null : tracking.error,
    },
  };
}

/** Árbol del plan y sus totales de avance; sin plan (un área sin módulos) no hay nada que pedir. */
export function usePlanView(planId: string | null): Remote<PlanView | null> {
  return useRemote<PlanView | null>(
    () => (planId ? loadPlanView(planId) : Promise.resolve({ ok: true, data: null })),
    `gestion-formacion:plan:${planId ?? 'none'}`,
  );
}

export interface CreatedModule {
  planId: string;
  moduleId: string;
}

/**
 * Crea un módulo en la opción elegida. Un área sin plan recibe primero su plan («Plan de formación
 * · <área>», válido para cualquier año) y su parte única; un plan de área sin partes (caso límite)
 * recibe la parte antes del módulo. Cada paso es una llamada auditada: si una falla, lo ya creado
 * queda y el siguiente intento lo reutiliza porque se relee el catálogo.
 */
export async function createModuleInPlan(
  option: PlanOption,
  tree: TrainingPlanTree | null,
  sectionId: string | null,
  input: CreateTrainingModuleInput,
): Promise<ApiResult<CreatedModule>> {
  let planId = option.plan?.id ?? null;
  let targetSection = sectionId ?? tree?.sections[0]?.id ?? null;

  if (planId === null) {
    if (!option.area) {
      return {
        ok: false,
        error: {
          statusCode: 0,
          code: 'error_red',
          message: 'No hay un plan elegido para crear el módulo.',
        },
      };
    }
    const plan = await createPlan({
      name: `Plan de formación · ${option.area.name}`,
      areaId: option.area.id,
      schoolYear: null,
    });
    if (!plan.ok) {
      return plan;
    }
    planId = plan.data.id;
  }
  if (targetSection === null) {
    const section = await createSection(planId, { title: AREA_SECTION_TITLE, subtitle: null });
    if (!section.ok) {
      return section;
    }
    targetSection = section.data.id;
  }
  const created = await createModule(targetSection, input);
  return created.ok ? { ok: true, data: { planId, moduleId: created.data.id } } : created;
}

export interface ModuleActionState {
  /** Módulo con una acción en curso. */
  busyId: string | null;
  /** Último resultado: éxito o el motivo que dio la API. */
  feedback: { tone: 'success' | 'error'; text: string } | null;
  run: (moduleId: string, title: string, action: ModuleStatusAction) => Promise<boolean>;
  clearFeedback: () => void;
}

const SUCCESS_TEXT: Record<ModuleStatusAction, (title: string) => string> = {
  publish: (title) => `«${title}» está publicado: los docentes del plan ya lo ven en su ruta.`,
  withdraw: (title) =>
    `«${title}» salió del plan. Su progreso se conserva y puedes restaurarlo cuando quieras.`,
  restore: (title) => `«${title}» volvió al plan y los docentes lo ven otra vez.`,
};

/**
 * Publicar, quitar del plan y restaurar. Tras cada acción se pide de nuevo el plan (`refresh`); si
 * la API la rechaza (por ejemplo, publicar sin contenido o un cambio de estado simultáneo) se
 * muestra su motivo y también se recarga, porque el estado del servidor ya puede ser otro.
 */
export function useModuleActions(refresh: () => Promise<unknown>): ModuleActionState {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ModuleActionState['feedback']>(null);

  const run = useCallback(
    async (moduleId: string, title: string, action: ModuleStatusAction): Promise<boolean> => {
      setBusyId(moduleId);
      setFeedback(null);
      const result = await changeModuleStatus(moduleId, action);
      setFeedback(
        result.ok
          ? { tone: 'success', text: SUCCESS_TEXT[action](title) }
          : { tone: 'error', text: result.error.message },
      );
      await refresh();
      setBusyId(null);
      return result.ok;
    },
    [refresh],
  );

  const clearFeedback = useCallback(() => setFeedback(null), []);
  return { busyId, feedback, run, clearFeedback };
}
