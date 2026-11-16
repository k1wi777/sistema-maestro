import {
  auditLogEntryDetailSchema,
  auditLogPageSchema,
  createPageSchema,
  teacherAssignmentSchema,
  type AuditLogEntry,
  type AuditLogEntryDetail,
  type AuditLogPage,
} from '@gns/shared';

import { api, callApi, parseResult, type ApiResult } from '@/shared/api';

import { auditFiltersToQuery, type AuditFilters } from '../model/audit-filters';
import type { NamedUser } from '../model/user-options';

export type { AuditLogEntry, AuditLogEntryDetail };

const LIMIT = '50';
const assignmentPageSchema = createPageSchema(teacherAssignmentSchema);

/** Una página de movimientos, del más reciente al más antiguo, con los filtros activos. */
export async function listAuditLog(
  filters: AuditFilters,
  cursor: string | null,
): Promise<ApiResult<AuditLogPage>> {
  const query = { ...auditFiltersToQuery(filters), limit: LIMIT, ...(cursor ? { cursor } : {}) };
  const result = await callApi(() => api.GET('/audit-log', { params: { query } }));
  return parseResult(result, auditLogPageSchema);
}

export async function getAuditEntry(id: string): Promise<ApiResult<AuditLogEntryDetail>> {
  const result = await callApi(() => api.GET('/audit-log/{id}', { params: { path: { id } } }));
  return parseResult(result, auditLogEntryDetailSchema);
}

/** CSV de la bitácora con los filtros vigentes; la API deja su propia fila de exportación. */
export async function exportAuditLog(filters: AuditFilters): Promise<ApiResult<Blob>> {
  const result = await callApi(() =>
    api.GET('/audit-log/export', {
      params: { query: auditFiltersToQuery(filters) },
      parseAs: 'blob',
    }),
  );
  return result.ok ? { ok: true, data: result.data } : result;
}

/**
 * Docentes con asignaciones del año vigente (todas las páginas), para el selector de usuario. Sin
 * año vigente la API responde 409: el selector se queda con los usuarios de los movimientos.
 */
export async function listAssignedTeachers(): Promise<ApiResult<NamedUser[]>> {
  const year = await callApi(() => api.GET('/school-years/current'));
  if (!year.ok) {
    return year.error.statusCode === 409 ? { ok: true, data: [] } : year;
  }
  const code = (year.data as { code: string }).code;
  const teachers = new Map<string, string>();
  for (let page = 1; ; page += 1) {
    const result = parseResult(
      await callApi(() =>
        api.GET('/teacher-assignments', {
          params: { query: { schoolYear: code, page: String(page), pageSize: '100' } },
        }),
      ),
      assignmentPageSchema,
    );
    if (!result.ok) {
      return result;
    }
    for (const assignment of result.data.items) {
      teachers.set(assignment.teacher.id, assignment.teacher.fullName);
    }
    if (page >= result.data.totalPages) {
      return { ok: true, data: [...teachers].map(([id, name]) => ({ id, name })) };
    }
  }
}
