'use client';

import {
  RecordStatus,
  type FieldJournalFilters,
  type FieldJournalSummary,
  type JournalReviewScope,
  type ObserverNote,
  type ObserverNoteFilters,
} from '@gns/shared';

import type { ApiResult } from '@/shared/api';
import { usePagedList, useRemote, type PagedList, type Remote } from '@/shared/data';

import { gradesWithoutCoordinator } from '@/shared/records';

import { listGrades, type CatalogGrade } from '../api/catalogs';
import { getReviewScope, listJournals } from '../api/field-journals';
import { listPlans } from '../api/lesson-plans';
import { listNotes } from '../api/observer-notes';
import type { InboxViewer } from './use-inbox-viewer';

const PAGE_SIZE = 20;

/** Diarios del alcance elegido (sus grados o todo el colegio), con filtros y «Cargar más». */
export function useJournalInbox(
  filters: Pick<
    FieldJournalFilters,
    'status' | 'gradeId' | 'groupId' | 'from' | 'to' | 'coordinatorId'
  >,
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

/** Filtros de la bandeja de observadores. */
export type NoteInboxFilters = Pick<ObserverNoteFilters, 'gradeId' | 'coordinatorId'> & {
  status?: RecordStatus;
};

/** Anotaciones del observador; sin orden explícito la API pone primero las situaciones Tipo III y II. */
export function useNoteInbox(filters: NoteInboxFilters): PagedList<ObserverNote> {
  return usePagedList<ObserverNote>(
    (page) => listNotes({ ...filters, page, pageSize: PAGE_SIZE }),
    `notes:${JSON.stringify(filters)}`,
  );
}

export interface PendingCounts {
  plans: number;
  journals: number;
  notes: number;
}

export interface FormatsOverview {
  counts: PendingCounts;
  /** Grados activos sin coordinadora (solo se calcula para administración). */
  uncovered: CatalogGrade[];
}

/**
 * Cifras del hub de Formatos. Coordinación: pendientes de revisión en sus grados. Administración:
 * total de registros de cada formato (solo consulta) y los grados activos sin coordinadora.
 */
async function loadOverview(
  administrator: boolean,
  userId: string | undefined,
): Promise<ApiResult<FormatsOverview>> {
  const mine = administrator ? undefined : userId;
  const pending = administrator ? undefined : RecordStatus.Submitted;
  const [plans, journals, notes, grades] = await Promise.all([
    listPlans({ status: pending, coordinatorId: mine, page: 1, pageSize: 1 }),
    administrator ? listJournals({ page: 1, pageSize: 1 }) : getReviewScope(),
    listNotes({ status: pending, coordinatorId: mine, page: 1, pageSize: 1 }),
    administrator ? listGrades() : Promise.resolve({ ok: true as const, data: [] }),
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
  if (!grades.ok) {
    return grades;
  }
  return {
    ok: true,
    data: {
      counts: {
        plans: plans.data.totalItems,
        journals:
          'counts' in journals.data ? journals.data.counts.submitted : journals.data.totalItems,
        notes: notes.data.totalItems,
      },
      uncovered: gradesWithoutCoordinator(grades.data),
    },
  };
}

/** Cifras del hub según el rol de la vista. */
export function useFormatsOverview(viewer: InboxViewer): Remote<FormatsOverview> {
  const userId = viewer.user?.id;
  return useRemote(
    () => loadOverview(viewer.isAdministrator, userId),
    `format-overview:${viewer.isAdministrator ? 'admin' : 'coord'}:${userId ?? ''}`,
  );
}
