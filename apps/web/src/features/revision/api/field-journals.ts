import {
  fieldJournalPageSchema,
  fieldJournalSchema,
  journalReviewScopeSchema,
  type FieldJournal,
  type FieldJournalFilters,
  type FieldJournalSummary,
  type JournalReviewScope,
  type Page,
} from '@gns/shared';

import { api, callApi, parseResult, type ApiResult, type components } from '@/shared/api';

type Schemas = components['schemas'];

export type ApproveJournalBody = Schemas['ApproveFieldJournalDto'];
export type ReturnJournalBody = Schemas['ReturnFieldJournalDto'];

export interface JournalListParams extends FieldJournalFilters {
  page: number;
  pageSize: number;
}

/** Bandeja de coordinación: los diarios de sus grados enviados alguna vez (administración, todos). */
export async function listJournals(
  params: JournalListParams,
): Promise<ApiResult<Page<FieldJournalSummary>>> {
  const { page, pageSize, ...filters } = params;
  const result = await callApi(() =>
    api.GET('/field-journals', {
      params: {
        query: { ...filters, scope: 'review', page: String(page), pageSize: String(pageSize) },
      },
    }),
  );
  return parseResult(result, fieldJournalPageSchema);
}

/** Cifras por estado y grados y grupos del alcance de revisión. */
export async function getReviewScope(): Promise<ApiResult<JournalReviewScope>> {
  const result = await callApi(() => api.GET('/field-journals/review-scope'));
  return parseResult(result, journalReviewScopeSchema);
}

export async function getJournal(id: string): Promise<ApiResult<FieldJournal>> {
  const result = await callApi(() => api.GET('/field-journals/{id}', { params: { path: { id } } }));
  return parseResult(result, fieldJournalSchema);
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
