'use client';

import {
  RecordStatus,
  type FieldJournalFilters,
  type FieldJournalSummary,
  type JournalReviewScope,
  type ObserverNote,
} from '@gns/shared';

import type { ApiResult } from '@/shared/api';
import { usePagedList, useRemote, type PagedList, type Remote } from '@/shared/data';

import { getReviewScope, listJournals } from '../api/field-journals';
import { listPlans } from '../api/lesson-plans';
import { listNotes } from '../api/observer-notes';

const PAGE_SIZE = 20;

/** Diarios de los grados de la persona de coordinación, con filtros y «Cargar más». */
export function useJournalInbox(
  filters: Pick<FieldJournalFilters, 'status' | 'gradeId' | 'groupId' | 'from' | 'to'>,
): PagedList<FieldJournalSummary> {
  return usePagedList<FieldJournalSummary>(
    (page) => listJournals({ ...filters, page, pageSize: PAGE_SIZE }),
    `journals:${JSON.stringify(filters)}`,
  );
}

/** Cifras por estado y grados y grupos del alcance de revisión. */
export function useJournalScope(): Remote<JournalReviewScope> {
  return useRemote(getReviewScope, 'journal-scope');
}

/** Anotaciones del observador; sin orden explícito la API pone primero las situaciones Tipo III y II. */
export function useNoteInbox(status: RecordStatus | undefined): PagedList<ObserverNote> {
  return usePagedList<ObserverNote>(
    (page) => listNotes({ status, page, pageSize: PAGE_SIZE }),
    `notes:${status ?? ''}`,
  );
}

export interface PendingCounts {
  plans: number;
  journals: number;
  notes: number;
}

async function loadPending(): Promise<ApiResult<PendingCounts>> {
  const [plans, journals, notes] = await Promise.all([
    listPlans({ status: RecordStatus.Submitted, page: 1, pageSize: 1 }),
    getReviewScope(),
    listNotes({ status: RecordStatus.Submitted, page: 1, pageSize: 1 }),
  ]);
  if (!plans.ok) {
    return plans;
  }
  if (!journals.ok) {
    return journals;
  }
  if (!notes.ok) {
    return notes;
  }
  return {
    ok: true,
    data: {
      plans: plans.data.totalItems,
      journals: journals.data.counts.submitted,
      notes: notes.data.totalItems,
    },
  };
}

/** Pendientes de revisión (enviados) de cada formato. */
export function usePendingCounts(): Remote<PendingCounts> {
  return useRemote(loadPending, 'format-pending');
}
