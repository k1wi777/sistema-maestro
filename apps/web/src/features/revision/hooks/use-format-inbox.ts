'use client';

import { RecordStatus, type FieldJournalSummary, type ObserverNote } from '@gns/shared';

import type { ApiResult } from '@/shared/api';
import { usePagedList, useRemote, type PagedList, type Remote } from '@/shared/data';

import { listJournals } from '../api/field-journals';
import { listPlans } from '../api/lesson-plans';
import { listNotes } from '../api/observer-notes';

const PAGE_SIZE = 20;

/** Diarios de campo de todos los docentes, con filtro por estado y «Cargar más». */
export function useJournalInbox(status: RecordStatus | undefined): PagedList<FieldJournalSummary> {
  return usePagedList<FieldJournalSummary>(
    (page) => listJournals({ status, page, pageSize: PAGE_SIZE }),
    `journals:${status ?? ''}`,
  );
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
    listJournals({ status: RecordStatus.Submitted, page: 1, pageSize: 1 }),
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
      journals: journals.data.totalItems,
      notes: notes.data.totalItems,
    },
  };
}

/** Pendientes de revisión (enviados) de cada formato. */
export function usePendingCounts(): Remote<PendingCounts> {
  return useRemote(loadPending, 'format-pending');
}
