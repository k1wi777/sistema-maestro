import {
  observerNotePageSchema,
  observerNoteSchema,
  reviewSchema,
  type ObserverNote,
  type ObserverNoteFilters,
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

export type ApproveNoteBody = Schemas['ApproveObserverNoteDto'];
export type ReturnNoteBody = Schemas['ReturnObserverNoteDto'];

export interface NoteListParams extends ObserverNoteFilters {
  page: number;
  pageSize: number;
}

/** Sin `sortBy`: la API ordena por prioridad (Tipo III y Tipo II primero) y luego por fecha. */
export async function listNotes(params: NoteListParams): Promise<ApiResult<Page<ObserverNote>>> {
  const { page, pageSize, ...rest } = params;
  const result = await callApi(() =>
    api.GET('/observer-notes', {
      params: { query: { ...rest, page: String(page), pageSize: String(pageSize) } },
    }),
  );
  return parseResult(result, observerNotePageSchema);
}

export async function getNote(id: string): Promise<ApiResult<ObserverNote>> {
  const result = await callApi(() => api.GET('/observer-notes/{id}', { params: { path: { id } } }));
  return parseResult(result, observerNoteSchema);
}

export async function listNoteReviews(id: string): Promise<ApiResult<Review[]>> {
  const result = await callApi(() =>
    api.GET('/observer-notes/{id}/reviews', { params: { path: { id } } }),
  );
  return parseListResult(result, reviewSchema);
}

export async function approveNote(
  id: string,
  body: ApproveNoteBody,
): Promise<ApiResult<ObserverNote>> {
  const result = await callApi(() =>
    api.POST('/observer-notes/{id}/approve', { params: { path: { id } }, body }),
  );
  return parseResult(result, observerNoteSchema);
}

export async function returnNote(
  id: string,
  body: ReturnNoteBody,
): Promise<ApiResult<ObserverNote>> {
  const result = await callApi(() =>
    api.POST('/observer-notes/{id}/return', { params: { path: { id } }, body }),
  );
  return parseResult(result, observerNoteSchema);
}

export async function voidNote(id: string, reason: string): Promise<ApiResult<ObserverNote>> {
  const result = await callApi(() =>
    api.POST('/observer-notes/{id}/void', { params: { path: { id } }, body: { reason } }),
  );
  return parseResult(result, observerNoteSchema);
}
