import {
  trainingModuleSchema,
  trainingPlanListSchema,
  trainingPlanSchema,
  trainingPlanTreeSchema,
  trainingSectionSchema,
  type CreateTrainingModuleInput,
  type CreateTrainingPlanInput,
  type CreateTrainingSectionInput,
  type TrainingModule,
  type TrainingPlan,
  type TrainingPlanSummary,
  type TrainingPlanTree,
  type TrainingSection,
} from '@gns/shared';

import { api, callApi, parseResult, type ApiResult } from '@/shared/api';

export type { TrainingPlanSummary, TrainingPlanTree };

export type ModuleStatusAction = 'publish' | 'withdraw' | 'restore';

/** Planes con su área y el conteo de módulos por estado. */
export async function listPlans(): Promise<ApiResult<TrainingPlanSummary[]>> {
  const result = await callApi(() => api.GET('/training-plans'));
  const parsed = parseResult(result, trainingPlanListSchema);
  return parsed.ok ? { ok: true, data: parsed.data.items } : parsed;
}

export async function createPlan(body: CreateTrainingPlanInput): Promise<ApiResult<TrainingPlan>> {
  const result = await callApi(() => api.POST('/training-plans', { body }));
  return parseResult(result, trainingPlanSchema);
}

/** Árbol de edición: partes en orden con sus módulos de todos los estados. */
export async function getPlanTree(planId: string): Promise<ApiResult<TrainingPlanTree>> {
  const result = await callApi(() =>
    api.GET('/training-plans/{id}/sections', { params: { path: { id: planId } } }),
  );
  return parseResult(result, trainingPlanTreeSchema);
}

export async function createSection(
  planId: string,
  body: CreateTrainingSectionInput,
): Promise<ApiResult<TrainingSection>> {
  const result = await callApi(() =>
    api.POST('/training-plans/{id}/sections', { params: { path: { id: planId } }, body }),
  );
  return parseResult(result, trainingSectionSchema);
}

export async function createModule(
  sectionId: string,
  body: CreateTrainingModuleInput,
): Promise<ApiResult<TrainingModule>> {
  const result = await callApi(() =>
    api.POST('/training-sections/{id}/modules', { params: { path: { id: sectionId } }, body }),
  );
  return parseResult(result, trainingModuleSchema);
}

/** Publicar, sacar del plan o restaurar un módulo; el progreso de los docentes no se toca. */
export async function changeModuleStatus(
  moduleId: string,
  action: ModuleStatusAction,
): Promise<ApiResult<TrainingModule>> {
  const params = { params: { path: { id: moduleId } } };
  const result = await callApi(() => {
    switch (action) {
      case 'publish':
        return api.POST('/training-modules/{id}/publish', params);
      case 'withdraw':
        return api.POST('/training-modules/{id}/withdraw', params);
      case 'restore':
        return api.POST('/training-modules/{id}/restore', params);
    }
  });
  return parseResult(result, trainingModuleSchema);
}
