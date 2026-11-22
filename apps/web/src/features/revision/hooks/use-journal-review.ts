'use client';

import { ApiErrorCode, JournalStatus, type FieldJournal } from '@gns/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

import { NETWORK_ERROR_CODE, type ApiError, type ApiResult } from '@/shared/api';
import { useRemote, type Remote } from '@/shared/data';
import { coordinatorOfGrade, type GradeCoordinator } from '@/shared/records';

import { listGrades } from '../api/catalogs';
import { approveJournal, getJournal, listJournals, returnJournal } from '../api/field-journals';
import {
  buildReturnBody,
  nextPending,
  observationCountLabel,
  pendingQueue,
} from '../model/journal-review';
import { CONFLICT_MESSAGE, SELF_REVIEW_MESSAGE, sentence } from '../model/messages';
import { useRevisionPaths } from './use-revision-paths';
import type { ReviewNotice } from './use-plan-review';

export interface JournalReviewData {
  journal: FieldJournal;
  /** Ids de los diarios enviados de su alcance, en el orden de la bandeja. */
  queue: string[];
  /** Coordinadora del grado del diario (quien lo revisa) o `null`. */
  coordinator: GradeCoordinator | null;
}

async function loadJournalReview(
  id: string,
  coordinatorId: string | undefined,
): Promise<ApiResult<JournalReviewData>> {
  const [journal, pending, grades] = await Promise.all([
    getJournal(id),
    listJournals({ status: JournalStatus.Submitted, coordinatorId, page: 1, pageSize: 100 }),
    listGrades(),
  ]);
  if (!journal.ok) {
    return journal;
  }
  if (!grades.ok) {
    return grades;
  }
  // Sin la cola el diario se revisa igual: solo faltaría «pasar al siguiente».
  return {
    ok: true,
    data: {
      journal: journal.data,
      queue: pending.ok ? pendingQueue(pending.data.items) : [],
      coordinator: coordinatorOfGrade(grades.data, journal.data.grade.id),
    },
  };
}

/** Un diario con la cola de pendientes de revisión de la persona de coordinación. */
export function useJournalReviewData(
  id: string,
  coordinatorId: string | undefined,
): Remote<JournalReviewData> {
  return useRemote(
    () => loadJournalReview(id, coordinatorId),
    `journal-review:${id}:${coordinatorId ?? ''}`,
  );
}

interface UseJournalReviewOptions {
  journal: FieldJournal;
  queue: string[];
  /** Vuelve a pedir el diario (tras un 409 o una decisión que no cambia de pantalla). */
  refresh: () => Promise<ApiError | null>;
}

/**
 * Decisiones de coordinación sobre un diario completo: observar anotaciones (cada una con su campo),
 * la observación general, «Aprobar y pasar al siguiente» y «Devolver con observaciones». Nunca
 * modifica el texto de las anotaciones.
 */
export function useJournalReview({ journal, queue, refresh }: UseJournalReviewOptions) {
  const router = useRouter();
  const paths = useRevisionPaths();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [observations, setObservations] = useState<Readonly<Record<string, string>>>({});
  const [general, setGeneral] = useState('');
  const [notice, setNotice] = useState<ReviewNotice | null>(null);
  const [busy, setBusy] = useState<'approve' | 'return' | null>(null);
  const busyRef = useRef(false);

  const canDecide = journal.viewer.canReview;
  const filled = Object.entries(observations).filter(([, text]) => text.trim() !== '');

  const toggle = useCallback((annotationId: string) => {
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(annotationId)) {
        next.delete(annotationId);
      } else {
        next.add(annotationId);
      }
      return next;
    });
  }, []);

  const observe = useCallback((annotationId: string, text: string) => {
    setObservations((previous) => ({ ...previous, [annotationId]: text }));
  }, []);

  const fail = useCallback(
    (error: ApiError) => {
      if (error.statusCode === 409) {
        setNotice({ tone: 'warning', text: CONFLICT_MESSAGE });
        void refresh();
        return;
      }
      if (error.code === ApiErrorCode.SelfReviewForbidden) {
        setNotice({ tone: 'error', text: SELF_REVIEW_MESSAGE });
        return;
      }
      const first = error.statusCode === 400 && 'errors' in error ? error.errors?.[0] : undefined;
      setNotice({
        tone: 'error',
        text: first ? sentence(first.reason) : error.message,
        retryable: error.code === NETWORK_ERROR_CODE,
      });
    },
    [refresh],
  );

  const run = useCallback(async (kind: 'approve' | 'return', task: () => Promise<void>) => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setBusy(kind);
    setNotice(null);
    try {
      await task();
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }, []);

  /** Aprueba con la firma de quien revisa y pasa al siguiente pendiente (o vuelve a la bandeja). */
  const approve = useCallback(async () => {
    if (!canDecide) {
      return;
    }
    await run('approve', async () => {
      const result = await approveJournal(
        journal.id,
        general.trim() ? { comment: general.trim() } : {},
      );
      if (!result.ok) {
        fail(result.error);
        return;
      }
      const next = nextPending(queue, journal.id);
      router.push(next ? `${paths.journals}/${next}` : paths.journals);
    });
  }, [canDecide, fail, general, journal.id, paths.journals, queue, router, run]);

  /** Devuelve con las observaciones escritas; queda firmado con el nombre de quien revisa. */
  const returnWithObservations = useCallback(async () => {
    if (!canDecide) {
      return;
    }
    const built = buildReturnBody(general, observations);
    if (!built.ok) {
      setNotice({ tone: 'warning', text: built.message });
      return;
    }
    await run('return', async () => {
      const result = await returnJournal(journal.id, {
        ...built.data,
        comment: built.data.comment ?? undefined,
      });
      if (!result.ok) {
        fail(result.error);
        return;
      }
      setGeneral('');
      setObservations({});
      setOpen(new Set());
      await refresh();
      setNotice({
        tone: 'success',
        text: `Devolviste el diario con ${observationCountLabel(built.data.observations.length)}${built.data.comment ? ' y una observación general' : ''}. Queda firmado con tu nombre.`,
      });
      window.scrollTo({ top: 0 });
    });
  }, [canDecide, fail, general, journal.id, observations, refresh, run]);

  return {
    canDecide,
    open,
    observations,
    observationCount: filled.length,
    general,
    setGeneral,
    notice,
    busy,
    toggle,
    observe,
    approve,
    returnWithObservations,
  };
}

export type JournalReview = ReturnType<typeof useJournalReview>;
