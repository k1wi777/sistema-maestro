import { api, callApi, type ApiResult, type components } from '@/shared/api';

type Schemas = components['schemas'];

export type TeachingAssignments = Schemas['MyAssignmentsDto_Output'];
export type AssignmentGrade = TeachingAssignments['grades'][number];
export type CatalogLevel = Schemas['LevelPageDto']['items'][number];
export type CatalogGrade = Schemas['GradePageDto']['items'][number];
export type CatalogArea = Schemas['AreaPageDto']['items'][number];
export type CatalogPeriod = Schemas['AcademicPeriodPageDto']['items'][number];

const ALL = '100';

/** Grados y áreas de las asignaciones activas del docente en el año vigente (409 sin año vigente). */
export function getMyAssignments(): Promise<ApiResult<TeachingAssignments>> {
  return callApi(() => api.GET('/me/assignments'));
}

export async function listPeriods(schoolYear: string): Promise<ApiResult<CatalogPeriod[]>> {
  const result = await callApi(() =>
    api.GET('/academic-periods', { params: { query: { schoolYear, pageSize: ALL } } }),
  );
  return result.ok ? { ok: true, data: result.data.items } : result;
}

export async function listLevels(): Promise<ApiResult<CatalogLevel[]>> {
  const result = await callApi(() => api.GET('/levels', { params: { query: { pageSize: ALL } } }));
  return result.ok ? { ok: true, data: result.data.items } : result;
}

export async function listGrades(levelId?: string): Promise<ApiResult<CatalogGrade[]>> {
  const result = await callApi(() =>
    api.GET('/grades', { params: { query: { pageSize: ALL, ...(levelId ? { levelId } : {}) } } }),
  );
  return result.ok ? { ok: true, data: result.data.items } : result;
}

export async function listAreas(): Promise<ApiResult<CatalogArea[]>> {
  const result = await callApi(() => api.GET('/areas', { params: { query: { pageSize: ALL } } }));
  return result.ok ? { ok: true, data: result.data.items } : result;
}
