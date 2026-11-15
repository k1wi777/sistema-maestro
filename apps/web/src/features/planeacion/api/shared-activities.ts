import {
  createPageSchema,
  sharedActivityCornersSchema,
  sharedActivitySchema,
  type Page,
  type SharedActivity,
  type SharedActivityListFilters,
} from '@gns/shared';

import { api, callApi, type ApiResult, type components } from '@/shared/api';

import { parseResult } from './parse';

type Schemas = components['schemas'];

export type CreateSharedActivityBody = Schemas['CreateSharedActivityDto'];
export type UpdateSharedActivityBody = Schemas['UpdateSharedActivityDto'];

const activityPageSchema = createPageSchema(sharedActivitySchema);

export interface SharedActivityListParams extends SharedActivityListFilters {
  page: number;
  pageSize: number;
}

export async function listSharedActivities(
  params: SharedActivityListParams,
): Promise<ApiResult<Page<SharedActivity>>> {
  const { page, pageSize, favorites, ...filters } = params;
  const result = await callApi(() =>
    api.GET('/shared-activities', {
      params: {
        query: {
          ...filters,
          ...(favorites ? { favorites: 'true' as const } : {}),
          page: String(page),
          pageSize: String(pageSize),
        },
      },
    }),
  );
  return parseResult(result, activityPageSchema);
}

export async function getSharedActivity(id: string): Promise<ApiResult<SharedActivity>> {
  const result = await callApi(() =>
    api.GET('/shared-activities/{id}', { params: { path: { id } } }),
  );
  return parseResult(result, sharedActivitySchema);
}

export async function createSharedActivity(
  body: CreateSharedActivityBody,
): Promise<ApiResult<SharedActivity>> {
  const result = await callApi(() => api.POST('/shared-activities', { body }));
  return parseResult(result, sharedActivitySchema);
}

export async function updateSharedActivity(
  id: string,
  body: UpdateSharedActivityBody,
): Promise<ApiResult<SharedActivity>> {
  const result = await callApi(() =>
    api.PATCH('/shared-activities/{id}', { params: { path: { id } }, body }),
  );
  return parseResult(result, sharedActivitySchema);
}

/** Retira la actividad del repositorio (la bitácora conserva el contenido). */
export async function withdrawSharedActivity(id: string): Promise<ApiResult<undefined>> {
  const result = await callApi(() =>
    api.DELETE('/shared-activities/{id}', { params: { path: { id } } }),
  );
  return result.ok ? { ok: true, data: undefined } : result;
}

/** Marca o desmarca una favorita; ambas llamadas son idempotentes. */
export async function setSharedActivityFavorite(
  id: string,
  favorite: boolean,
): Promise<ApiResult<undefined>> {
  const result = await callApi(() =>
    favorite
      ? api.PUT('/shared-activities/{id}/favorite', { params: { path: { id } } })
      : api.DELETE('/shared-activities/{id}/favorite', { params: { path: { id } } }),
  );
  return result.ok ? { ok: true, data: undefined } : result;
}

/** Rincones o zonas en uso en el repositorio, ordenados; opcionalmente de un solo nivel. */
export async function listLearningCorners(levelId?: string): Promise<ApiResult<string[]>> {
  const result = await callApi(() =>
    api.GET('/shared-activities/learning-corners', {
      params: { query: levelId ? { levelId } : {} },
    }),
  );
  const parsed = parseResult(result, sharedActivityCornersSchema);
  return parsed.ok ? { ok: true, data: parsed.data.items } : parsed;
}
