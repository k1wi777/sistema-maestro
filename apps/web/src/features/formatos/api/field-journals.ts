import {
  fieldJournalDaySchema,
  fieldJournalPageSchema,
  fieldJournalSchema,
  todayJournalsSchema,
  type FieldJournal,
  type FieldJournalDay,
  type FieldJournalFilters,
  type FieldJournalSummary,
  type Page,
  type TodayJournals,
} from '@gns/shared';

import { api, callApi, parseResult, type ApiResult, type components } from '@/shared/api';

type Schemas = components['schemas'];

export type CreateAnnotationBody = Schemas['CreateAnnotationDto'];
export type UpdateAnnotationBody = Schemas['UpdateAnnotationDto'];

export interface JournalListParams extends FieldJournalFilters {
  page: number;
  pageSize: number;
}

export async function listFieldJournals(
  params: JournalListParams,
): Promise<ApiResult<Page<FieldJournalSummary>>> {
  const { page, pageSize, ...filters } = params;
  const result = await callApi(() =>
    api.GET('/field-journals', {
      params: { query: { ...filters, page: String(page), pageSize: String(pageSize) } },
    }),
  );
  return parseResult(result, fieldJournalPageSchema);
}

/** Bloque «Hoy»: por cada grupo del docente, el diario de hoy si existe. */
export async function getTodayJournals(): Promise<ApiResult<TodayJournals>> {
  const result = await callApi(() => api.GET('/field-journals/today'));
  return parseResult(result, todayJournalsSchema);
}

/** El diario de un grupo y fecha; `id` nulo si nadie ha agregado todavía la primera anotación. */
export async function getJournalDay(
  groupId: string,
  date: string,
): Promise<ApiResult<FieldJournalDay>> {
  const result = await callApi(() =>
    api.GET('/field-journals/day', { params: { query: { groupId, date } } }),
  );
  return parseResult(result, fieldJournalDaySchema);
}

/** Cada escritura devuelve el diario completo. */
export async function addAnnotation(body: CreateAnnotationBody): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() => api.POST('/field-journals/annotations', { body }));
  return parseResult(result, fieldJournalSchema);
}

export async function updateAnnotation(
  id: string,
  annotationId: string,
  body: UpdateAnnotationBody,
): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() =>
    api.PATCH('/field-journals/{id}/annotations/{annotationId}', {
      params: { path: { id, annotationId } },
      body,
    }),
  );
  return parseResult(result, fieldJournalSchema);
}

export async function markAnnotationReady(
  id: string,
  annotationId: string,
): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() =>
    api.POST('/field-journals/{id}/annotations/{annotationId}/ready', {
      params: { path: { id, annotationId } },
    }),
  );
  return parseResult(result, fieldJournalSchema);
}

export async function markAnnotationDraft(
  id: string,
  annotationId: string,
): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() =>
    api.POST('/field-journals/{id}/annotations/{annotationId}/draft', {
      params: { path: { id, annotationId } },
    }),
  );
  return parseResult(result, fieldJournalSchema);
}

export async function submitFieldJournal(id: string): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() =>
    api.POST('/field-journals/{id}/submit', { params: { path: { id } } }),
  );
  return parseResult(result, fieldJournalSchema);
}

export async function resubmitFieldJournal(id: string): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() =>
    api.POST('/field-journals/{id}/resubmit', { params: { path: { id } } }),
  );
  return parseResult(result, fieldJournalSchema);
}

export async function voidFieldJournal(
  id: string,
  reason: string,
): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() =>
    api.POST('/field-journals/{id}/void', { params: { path: { id } }, body: { reason } }),
  );
  return parseResult(result, fieldJournalSchema);
}
