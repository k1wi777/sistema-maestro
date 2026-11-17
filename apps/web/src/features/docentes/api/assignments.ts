import {
  createPageSchema,
  schoolYearEntitySchema,
  teacherAssignmentSchema,
  type SchoolYear,
  type TeacherAssignment,
  type TeacherAssignmentStatus,
} from '@gns/shared';

import { api, callApi, parseResult, type ApiResult, type components } from '@/shared/api';

type Schemas = components['schemas'];

export type CatalogGrade = Schemas['GradePageDto']['items'][number];
export type CatalogArea = Schemas['AreaPageDto']['items'][number];
export type CatalogGroup = Schemas['GroupPageDto']['items'][number];
export type CatalogLevel = Schemas['LevelPageDto']['items'][number];

const assignmentPageSchema = createPageSchema(teacherAssignmentSchema);
const ALL = '100';

export async function listGrades(): Promise<ApiResult<CatalogGrade[]>> {
  const result = await callApi(() => api.GET('/grades', { params: { query: { pageSize: ALL } } }));
  return result.ok ? { ok: true, data: result.data.items } : result;
}

export async function listAreas(): Promise<ApiResult<CatalogArea[]>> {
  const result = await callApi(() => api.GET('/areas', { params: { query: { pageSize: ALL } } }));
  return result.ok ? { ok: true, data: result.data.items } : result;
}

/** Grupos activos: solo a ellos se puede asignar. */
export async function listGroups(): Promise<ApiResult<CatalogGroup[]>> {
  const result = await callApi(() =>
    api.GET('/groups', { params: { query: { pageSize: ALL, active: 'true' } } }),
  );
  return result.ok ? { ok: true, data: result.data.items } : result;
}

export async function listLevels(): Promise<ApiResult<CatalogLevel[]>> {
  const result = await callApi(() => api.GET('/levels', { params: { query: { pageSize: ALL } } }));
  return result.ok ? { ok: true, data: result.data.items } : result;
}

/** Año lectivo vigente; sin año vigente la API responde 409 y aquí es `null` (la pantalla avisa). */
export async function getCurrentSchoolYear(): Promise<ApiResult<SchoolYear | null>> {
  const result = await callApi(() => api.GET('/school-years/current'));
  if (!result.ok) {
    return result.error.statusCode === 409 ? { ok: true, data: null } : result;
  }
  return parseResult(result, schoolYearEntitySchema);
}

/** Todas las asignaciones del año (activas y retiradas), página a página. */
export async function listYearAssignments(
  schoolYear: string,
): Promise<ApiResult<TeacherAssignment[]>> {
  const assignments: TeacherAssignment[] = [];
  for (let page = 1; ; page += 1) {
    const result = parseResult(
      await callApi(() =>
        api.GET('/teacher-assignments', {
          params: { query: { schoolYear, page: String(page), pageSize: ALL } },
        }),
      ),
      assignmentPageSchema,
    );
    if (!result.ok) {
      return result;
    }
    assignments.push(...result.data.items);
    if (page >= result.data.totalPages) {
      return { ok: true, data: assignments };
    }
  }
}

export async function createAssignment(input: {
  teacherId: string;
  groupId: string;
  areaId: string;
  isHomeroomTeacher?: boolean;
}): Promise<ApiResult<TeacherAssignment>> {
  const result = await callApi(() =>
    api.POST('/teacher-assignments', { body: { isHomeroomTeacher: false, ...input } }),
  );
  return parseResult(result, teacherAssignmentSchema);
}

/** Retira o reactiva una asignación: nunca se borra. */
export async function setAssignmentStatus(
  id: string,
  status: TeacherAssignmentStatus,
): Promise<ApiResult<TeacherAssignment>> {
  const result = await callApi(() =>
    api.PATCH('/teacher-assignments/{id}/status', { params: { path: { id } }, body: { status } }),
  );
  return parseResult(result, teacherAssignmentSchema);
}

export async function setHomeroom(
  id: string,
  isHomeroomTeacher: boolean,
): Promise<ApiResult<TeacherAssignment>> {
  const result = await callApi(() =>
    api.PATCH('/teacher-assignments/{id}', {
      params: { path: { id } },
      body: { isHomeroomTeacher },
    }),
  );
  return parseResult(result, teacherAssignmentSchema);
}
