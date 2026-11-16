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

export type ApproveJournalBody = Schemas['ApproveFieldJournalDto'];
export type ReturnJournalBody = Schemas['ReturnFieldJournalDto'];

export interface JournalListParams extends FieldJournalFilters {
  page: number;
  pageSize: number;
}

export async function listJournals(
  params: JournalListParams,
): Promise<ApiResult<Page<FieldJournalSummary>>> {
  const { page, pageSize, ...rest } = params;
  const result = await callApi(() =>
    api.GET('/field-journals', {
      params: { query: { ...rest, page: String(page), pageSize: String(pageSize) } },
    }),
  );
  return parseResult(result, fieldJournalPageSchema);
}

export async function getJournal(id: string): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() => api.GET('/field-journals/{id}', { params: { path: { id } } }));
  return parseResult(result, fieldJournalSchema);
}

export async function listJournalReviews(id: string): Promise<ApiResult<Review[]>> {
  const result = await callApi(() =>
    api.GET('/field-journals/{id}/reviews', { params: { path: { id } } }),
  );
  return parseListResult(result, reviewSchema);
}

export async function approveJournal(
  id: string,
  body: ApproveJournalBody,
): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() =>
    api.POST('/field-journals/{id}/approve', { params: { path: { id } }, body }),
  );
  return parseResult(result, fieldJournalSchema);
}

export async function returnJournal(
  id: string,
  body: ReturnJournalBody,
): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() =>
    api.POST('/field-journals/{id}/return', { params: { path: { id } }, body }),
  );
  return parseResult(result, fieldJournalSchema);
}

export async function voidJournal(id: string, reason: string): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() =>
    api.POST('/field-journals/{id}/void', { params: { path: { id } }, body: { reason } }),
  );
  return parseResult(result, fieldJournalSchema);
}
