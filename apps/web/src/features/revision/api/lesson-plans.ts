import {
  createPageSchema,
  lessonPlanSchema,
  reviewSchema,
  type LessonPlan,
  type LessonPlanFilters,
  type LessonPlanSortField,
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

export type ApprovePlanBody = Schemas['ApproveLessonPlanDto'];
export type ReturnPlanBody = Schemas['ReturnLessonPlanDto'];

const planPageSchema = createPageSchema(lessonPlanSchema);

export interface PlanListParams extends LessonPlanFilters {
  page: number;
  pageSize: number;
  sortBy?: LessonPlanSortField;
  sortOrder?: 'asc' | 'desc';
}

/** Coordinación ve las planeaciones de todos los docentes. */
export async function listPlans(params: PlanListParams): Promise<ApiResult<Page<LessonPlan>>> {
  const { page, pageSize, ...rest } = params;
  const result = await callApi(() =>
    api.GET('/lesson-plans', {
      params: { query: { ...rest, page: String(page), pageSize: String(pageSize) } },
    }),
  );
  return parseResult(result, planPageSchema);
}

export async function getPlan(id: string): Promise<ApiResult<LessonPlan>> {
  const result = await callApi(() => api.GET('/lesson-plans/{id}', { params: { path: { id } } }));
  return parseResult(result, lessonPlanSchema);
}

/** Historial de revisión: filas `ajuste` y decisión con la misma fecha. */
export async function listPlanReviews(id: string): Promise<ApiResult<Review[]>> {
  const result = await callApi(() =>
    api.GET('/lesson-plans/{id}/reviews', { params: { path: { id } } }),
  );
  return parseListResult(result, reviewSchema);
}

export async function approvePlan(
  id: string,
  body: ApprovePlanBody,
): Promise<ApiResult<LessonPlan>> {
  const result = await callApi(() =>
    api.POST('/lesson-plans/{id}/approve', { params: { path: { id } }, body }),
  );
  return parseResult(result, lessonPlanSchema);
}

export async function returnPlan(id: string, body: ReturnPlanBody): Promise<ApiResult<LessonPlan>> {
  const result = await callApi(() =>
    api.POST('/lesson-plans/{id}/return', { params: { path: { id } }, body }),
  );
  return parseResult(result, lessonPlanSchema);
}

export async function voidPlan(id: string, reason: string): Promise<ApiResult<LessonPlan>> {
  const result = await callApi(() =>
    api.POST('/lesson-plans/{id}/void', { params: { path: { id } }, body: { reason } }),
  );
  return parseResult(result, lessonPlanSchema);
}
