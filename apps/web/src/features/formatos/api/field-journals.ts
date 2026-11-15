import {
  fieldJournalPageSchema,
  fieldJournalSchema,
  reviewSchema,
  type FieldJournal,
  type FieldJournalFilters,
  type FieldJournalSummary,
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

export type CreateJournalBody = Schemas['CreateFieldJournalDto'];
export type CreateJournalEntryBody = Schemas['CreateFieldJournalEntryDto'];
export type UpdateJournalEntryBody = Schemas['UpdateFieldJournalEntryDto'];

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

export async function getFieldJournal(id: string): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() => api.GET('/field-journals/{id}', { params: { path: { id } } }));
  return parseResult(result, fieldJournalSchema);
}

export async function createFieldJournal(
  body: CreateJournalBody,
): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() => api.POST('/field-journals', { body }));
  return parseResult(result, fieldJournalSchema);
}

/** Cada escritura de un registro devuelve la hoja completa. */
export async function addJournalEntry(
  id: string,
  body: CreateJournalEntryBody,
): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() =>
    api.POST('/field-journals/{id}/entries', { params: { path: { id } }, body }),
  );
  return parseResult(result, fieldJournalSchema);
}

export async function updateJournalEntry(
  id: string,
  entryId: string,
  body: UpdateJournalEntryBody,
): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() =>
    api.PATCH('/field-journals/{id}/entries/{entryId}', {
      params: { path: { id, entryId } },
      body,
    }),
  );
  return parseResult(result, fieldJournalSchema);
}

export async function removeJournalEntry(
  id: string,
  entryId: string,
): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() =>
    api.DELETE('/field-journals/{id}/entries/{entryId}', { params: { path: { id, entryId } } }),
  );
  return parseResult(result, fieldJournalSchema);
}

export async function submitFieldJournal(id: string): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() =>
    api.POST('/field-journals/{id}/submit', { params: { path: { id } } }),
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

/** Historial de revisión: filas `ajuste` y decisión con la misma fecha. */
export async function listFieldJournalReviews(id: string): Promise<ApiResult<Review[]>> {
  const result = await callApi(() =>
    api.GET('/field-journals/{id}/reviews', { params: { path: { id } } }),
  );
  return parseListResult(result, reviewSchema);
}
