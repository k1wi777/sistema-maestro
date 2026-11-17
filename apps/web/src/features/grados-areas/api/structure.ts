import { academicStructureSchema, type AcademicStructure, type AreaType } from '@gns/shared';

import { api, callApi, parseResult, type ApiResult } from '@/shared/api';

export async function getAcademicStructure(): Promise<ApiResult<AcademicStructure>> {
  const result = await callApi(() => api.GET('/academic-structure'));
  return parseResult(result, academicStructureSchema);
}

/** Las escrituras devuelven el elemento; la pantalla solo necesita saber si salió bien y el error. */
type Done = ApiResult<unknown>;

export async function createGrade(body: {
  name: string;
  levelId: string;
  sortOrder: number;
}): Promise<Done> {
  return callApi(() => api.POST('/grades', { body }));
}

export async function updateGrade(
  id: string,
  body: { name?: string; levelId?: string; sortOrder?: number; active?: boolean },
): Promise<Done> {
  return callApi(() => api.PATCH('/grades/{id}', { params: { path: { id } }, body }));
}

export async function deleteGrade(id: string): Promise<Done> {
  return callApi(() => api.DELETE('/grades/{id}', { params: { path: { id } } }));
}

export async function createGroup(gradeId: string, name: string): Promise<Done> {
  return callApi(() => api.POST('/groups', { body: { gradeId, name } }));
}

export async function updateGroup(
  id: string,
  body: { name?: string; active?: boolean },
): Promise<Done> {
  return callApi(() => api.PATCH('/groups/{id}', { params: { path: { id } }, body }));
}

export async function deleteGroup(id: string): Promise<Done> {
  return callApi(() => api.DELETE('/groups/{id}', { params: { path: { id } } }));
}

export interface AreaInput {
  name: string;
  type: AreaType;
  levelIds: string[];
}

export async function createArea(body: AreaInput): Promise<Done> {
  return callApi(() => api.POST('/areas', { body }));
}

export async function updateArea(
  id: string,
  body: Partial<AreaInput> & { active?: boolean },
): Promise<Done> {
  return callApi(() => api.PATCH('/areas/{id}', { params: { path: { id } }, body }));
}

export async function deleteArea(id: string): Promise<Done> {
  return callApi(() => api.DELETE('/areas/{id}', { params: { path: { id } } }));
}

export async function setCoordinatorGrades(id: string, gradeIds: string[]): Promise<Done> {
  return callApi(() =>
    api.PUT('/coordinators/{id}/grades', { params: { path: { id } }, body: { gradeIds } }),
  );
}
