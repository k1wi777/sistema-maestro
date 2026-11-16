import { api, callApi, type ApiResult, type components } from '@/shared/api';

type Schemas = components['schemas'];

export type CatalogGrade = Schemas['GradePageDto']['items'][number];
export type CatalogArea = Schemas['AreaPageDto']['items'][number];

const ALL = '100';

export async function listGrades(): Promise<ApiResult<CatalogGrade[]>> {
  const result = await callApi(() => api.GET('/grades', { params: { query: { pageSize: ALL } } }));
  return result.ok ? { ok: true, data: result.data.items } : result;
}

export async function listAreas(): Promise<ApiResult<CatalogArea[]>> {
  const result = await callApi(() => api.GET('/areas', { params: { query: { pageSize: ALL } } }));
  return result.ok ? { ok: true, data: result.data.items } : result;
}
