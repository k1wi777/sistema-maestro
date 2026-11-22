import {
  createPageSchema,
  lessonPlanResourceSchema,
  lessonPlanSchema,
  reviewSchema,
  type LessonPlan,
  type LessonPlanFilters,
  type LessonPlanResource,
  type Page,
  type Review,
} from '@gns/shared';

import {
  api,
  callApi,
  parseListResult,
  parseResult,
  type ApiResult,
  type components,
} from '@/shared/api';

type Schemas = components['schemas'];

export type CreateLessonPlanBody = Schemas['CreateLessonPlanDto'];
export type UpdateLessonPlanBody = Schemas['UpdateLessonPlanDto'];
export type CreateResourceBody = Schemas['CreateLessonPlanResourceDto'];

const planPageSchema = createPageSchema(lessonPlanSchema);

export interface LessonPlanListParams extends LessonPlanFilters {
  page: number;
  pageSize: number;
}

export async function listLessonPlans(
  params: LessonPlanListParams,
): Promise<ApiResult<Page<LessonPlan>>> {
  const { page, pageSize, ...filters } = params;
  const result = await callApi(() =>
    api.GET('/lesson-plans', {
      params: { query: { ...filters, page: String(page), pageSize: String(pageSize) } },
    }),
  );
  return parseResult(result, planPageSchema);
}

export async function getLessonPlan(id: string): Promise<ApiResult<LessonPlan>> {
  const result = await callApi(() => api.GET('/lesson-plans/{id}', { params: { path: { id } } }));
  return parseResult(result, lessonPlanSchema);
}

export async function createLessonPlan(body: CreateLessonPlanBody): Promise<ApiResult<LessonPlan>> {
  const result = await callApi(() => api.POST('/lesson-plans', { body }));
  return parseResult(result, lessonPlanSchema);
}

/** Guardado parcial: la API solo cambia los campos que van en el cuerpo. */
export async function updateLessonPlan(
  id: string,
  body: UpdateLessonPlanBody,
): Promise<ApiResult<LessonPlan>> {
  const result = await callApi(() =>
    api.PATCH('/lesson-plans/{id}', { params: { path: { id } }, body }),
  );
  return parseResult(result, lessonPlanSchema);
}

export async function submitLessonPlan(id: string): Promise<ApiResult<LessonPlan>> {
  const result = await callApi(() =>
    api.POST('/lesson-plans/{id}/submit', { params: { path: { id } } }),
  );
  return parseResult(result, lessonPlanSchema);
}

export async function voidLessonPlan(id: string, reason: string): Promise<ApiResult<LessonPlan>> {
  const result = await callApi(() =>
    api.POST('/lesson-plans/{id}/void', { params: { path: { id } }, body: { reason } }),
  );
  return parseResult(result, lessonPlanSchema);
}

/** Borrado real de un borrador propio que nunca se envió (204 sin cuerpo). */
export async function discardLessonPlan(id: string): Promise<ApiResult<undefined>> {
  const result = await callApi(() =>
    api.DELETE('/lesson-plans/{id}', { params: { path: { id } } }),
  );
  return result.ok ? { ok: true, data: undefined } : result;
}

/** Historial de revisión: filas `ajuste` y decisión con la misma fecha. */
export async function listLessonPlanReviews(id: string): Promise<ApiResult<Review[]>> {
  const result = await callApi(() =>
    api.GET('/lesson-plans/{id}/reviews', { params: { path: { id } } }),
  );
  return parseListResult(result, reviewSchema);
}

export async function addLessonPlanResource(
  id: string,
  body: CreateResourceBody,
): Promise<ApiResult<LessonPlanResource>> {
  const result = await callApi(() =>
    api.POST('/lesson-plans/{id}/resources', { params: { path: { id } }, body }),
  );
  return parseResult(result, lessonPlanResourceSchema);
}

export async function removeLessonPlanResource(
  id: string,
  resourceId: string,
): Promise<ApiResult<undefined>> {
  const result = await callApi(() =>
    api.DELETE('/lesson-plans/{id}/resources/{resourceId}', {
      params: { path: { id, resourceId } },
    }),
  );
  return result.ok ? { ok: true, data: undefined } : result;
}
