import { api, callApi, type ApiResult, type components } from '@/shared/api';

export type CatalogArea = components['schemas']['AreaPageDto']['items'][number];

/** Todas las áreas del colegio, para elegir el plan de formación. */
export async function listAreas(): Promise<ApiResult<CatalogArea[]>> {
  const result = await callApi(() => api.GET('/areas', { params: { query: { pageSize: '100' } } }));
  return result.ok ? { ok: true, data: result.data.items } : result;
}
