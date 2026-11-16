import {
  activitySchema,
  challengeQuestionSchema,
  slideSchema,
  trainingModuleDetailSchema,
  trainingModuleSchema,
  type Activity,
  type ChallengeQuestion,
  type ChallengeQuestionInput,
  type CreateSlideInput,
  type Slide,
  type TrainingModule,
  type TrainingModuleDetail,
  type UpdateSlideInput,
  type UpdateTrainingModuleInput,
} from '@gns/shared';

import { api, callApi, parseResult, type ApiResult } from '@/shared/api';

export type { Activity, ChallengeQuestion, Slide, TrainingModule, TrainingModuleDetail };

/** Módulo completo de coordinación: incluye las soluciones del Desafío. */
export async function getModuleDetail(moduleId: string): Promise<ApiResult<TrainingModuleDetail>> {
  const result = await callApi(() =>
    api.GET('/training-modules/{id}', { params: { path: { id: moduleId } } }),
  );
  return parseResult(result, trainingModuleDetailSchema);
}

export async function updateModule(
  moduleId: string,
  body: UpdateTrainingModuleInput,
): Promise<ApiResult<TrainingModule>> {
  const result = await callApi(() =>
    api.PATCH('/training-modules/{id}', { params: { path: { id: moduleId } }, body }),
  );
  return parseResult(result, trainingModuleSchema);
}

// ---------- Diapositivas ----------

export async function addSlide(
  moduleId: string,
  body: CreateSlideInput,
): Promise<ApiResult<Slide>> {
  const result = await callApi(() =>
    api.POST('/training-modules/{id}/slides', { params: { path: { id: moduleId } }, body }),
  );
  return parseResult(result, slideSchema);
}

export async function updateSlide(
  moduleId: string,
  slideId: string,
  body: UpdateSlideInput,
): Promise<ApiResult<Slide>> {
  const result = await callApi(() =>
    api.PATCH('/training-modules/{id}/slides/{slideId}', {
      params: { path: { id: moduleId, slideId } },
      body,
    }),
  );
  return parseResult(result, slideSchema);
}

export async function removeSlide(
  moduleId: string,
  slideId: string,
): Promise<ApiResult<undefined>> {
  const result = await callApi(() =>
    api.DELETE('/training-modules/{id}/slides/{slideId}', {
      params: { path: { id: moduleId, slideId } },
    }),
  );
  return result.ok ? { ok: true, data: undefined } : result;
}

// ---------- Preguntas del Desafío ----------

export async function addQuestion(
  moduleId: string,
  body: ChallengeQuestionInput,
): Promise<ApiResult<ChallengeQuestion>> {
  const result = await callApi(() =>
    api.POST('/training-modules/{id}/questions', { params: { path: { id: moduleId } }, body }),
  );
  return parseResult(result, challengeQuestionSchema);
}

/** La API reemplaza la pregunta entera (también sus opciones). */
export async function replaceQuestion(
  moduleId: string,
  questionId: string,
  body: ChallengeQuestionInput,
): Promise<ApiResult<ChallengeQuestion>> {
  const result = await callApi(() =>
    api.PUT('/training-modules/{id}/questions/{questionId}', {
      params: { path: { id: moduleId, questionId } },
      body,
    }),
  );
  return parseResult(result, challengeQuestionSchema);
}

export async function removeQuestion(
  moduleId: string,
  questionId: string,
): Promise<ApiResult<undefined>> {
  const result = await callApi(() =>
    api.DELETE('/training-modules/{id}/questions/{questionId}', {
      params: { path: { id: moduleId, questionId } },
    }),
  );
  return result.ok ? { ok: true, data: undefined } : result;
}

// ---------- Actividades: solo gestión de las existentes (crearlas es de la parte 2) ----------

export async function updateActivityRequired(
  moduleId: string,
  activityId: string,
  isRequired: boolean,
): Promise<ApiResult<Activity>> {
  const result = await callApi(() =>
    api.PATCH('/training-modules/{id}/activities/{activityId}', {
      params: { path: { id: moduleId, activityId } },
      body: { isRequired },
    }),
  );
  return parseResult(result, activitySchema);
}

export async function withdrawActivity(
  moduleId: string,
  activityId: string,
): Promise<ApiResult<Activity>> {
  const result = await callApi(() =>
    api.POST('/training-modules/{id}/activities/{activityId}/withdraw', {
      params: { path: { id: moduleId, activityId } },
    }),
  );
  return parseResult(result, activitySchema);
}

export async function restoreActivity(
  moduleId: string,
  activityId: string,
): Promise<ApiResult<Activity>> {
  const result = await callApi(() =>
    api.POST('/training-modules/{id}/activities/{activityId}/restore', {
      params: { path: { id: moduleId, activityId } },
    }),
  );
  return parseResult(result, activitySchema);
}

/** Orden completo de las actividades del módulo; devuelve el módulo con la lista reordenada. */
export async function setActivityOrder(
  moduleId: string,
  ids: string[],
): Promise<ApiResult<TrainingModuleDetail>> {
  const result = await callApi(() =>
    api.PUT('/training-modules/{id}/activity-order', {
      params: { path: { id: moduleId } },
      body: { ids },
    }),
  );
  return parseResult(result, trainingModuleDetailSchema);
}
