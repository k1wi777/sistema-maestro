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

export type CreateObserverNoteBody = Schemas['CreateObserverNoteDto'];
export type UpdateObserverNoteBody = Schemas['UpdateObserverNoteDto'];

export interface ObserverNoteListParams extends ObserverNoteFilters {
  page: number;
  pageSize: number;
}

/** Orden por fecha (la más reciente primero), no por la prioridad de la bandeja de coordinación. */
export async function listObserverNotes(
  params: ObserverNoteListParams,
): Promise<ApiResult<Page<ObserverNote>>> {
  const { page, pageSize, ...filters } = params;
  const result = await callApi(() =>
    api.GET('/observer-notes', {
      params: {
        query: {
          ...filters,
          sortBy: 'date',
          sortOrder: 'desc',
          page: String(page),
          pageSize: String(pageSize),
        },
      },
    }),
  );
  return parseResult(result, observerNotePageSchema);
}

export async function getObserverNote(id: string): Promise<ApiResult<ObserverNote>> {
  const result = await callApi(() => api.GET('/observer-notes/{id}', { params: { path: { id } } }));
  return parseResult(result, observerNoteSchema);
}

export async function createObserverNote(
  body: CreateObserverNoteBody,
): Promise<ApiResult<ObserverNote>> {
  const result = await callApi(() => api.POST('/observer-notes', { body }));
  return parseResult(result, observerNoteSchema);
}

/** Guardado parcial: la API solo cambia los campos que van en el cuerpo. */
export async function updateObserverNote(
  id: string,
  body: UpdateObserverNoteBody,
): Promise<ApiResult<ObserverNote>> {
  const result = await callApi(() =>
    api.PATCH('/observer-notes/{id}', { params: { path: { id } }, body }),
  );
  return parseResult(result, observerNoteSchema);
}

export async function submitObserverNote(id: string): Promise<ApiResult<ObserverNote>> {
  const result = await callApi(() =>
    api.POST('/observer-notes/{id}/submit', { params: { path: { id } } }),
  );
  return parseResult(result, observerNoteSchema);
}

export async function voidObserverNote(
  id: string,
  reason: string,
): Promise<ApiResult<ObserverNote>> {
  const result = await callApi(() =>
    api.POST('/observer-notes/{id}/void', { params: { path: { id } }, body: { reason } }),
  );
  return parseResult(result, observerNoteSchema);
}

/** Borrado real de una anotación propia en borrador (204 sin cuerpo). */
export async function discardObserverNote(id: string): Promise<ApiResult<undefined>> {
  const result = await callApi(() =>
    api.DELETE('/observer-notes/{id}', { params: { path: { id } } }),
  );
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function listObserverNoteReviews(id: string): Promise<ApiResult<Review[]>> {
  const result = await callApi(() =>
    api.GET('/observer-notes/{id}/reviews', { params: { path: { id } } }),
  );
  return parseListResult(result, reviewSchema);
}
