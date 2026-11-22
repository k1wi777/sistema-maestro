'use client';

import {
  ApiErrorCode,
  RecordStatus,
  approveObserverNoteSchema,
  returnObserverNoteSchema,
  REVIEW_COMMENT_MAX_LENGTH,
  type ObserverNote,
  type Review,
} from '@gns/shared';
import { useCallback, useMemo, useRef, useState } from 'react';

import { NETWORK_ERROR_CODE, type ApiError, type ApiResult } from '@/shared/api';
import { useRemote, type Remote } from '@/shared/data';
import {
  canReviewGrade,
  consultNotice,
  coordinatorOfGrade,
  type GradeCoordinator,
} from '@/shared/records';
import { useSession } from '@/shared/session';

import { listGrades } from '../api/catalogs';
import { approveNote, getNote, listNoteReviews, returnNote, voidNote } from '../api/observer-notes';
import { buildHistory } from '../model/history';
import {
  CONFLICT_MESSAGE,
  SELF_REVIEW_MESSAGE,
  formatReadOnlyReason,
  sentence,
} from '../model/messages';
import type { ReviewNotice } from './use-plan-review';

/** Registro revisable por coordinación: lo que comparten las anotaciones del observador. */
interface ReviewableRecord {
  id: string;
  status: RecordStatus;
  teacher: { id: string; fullName: string };
  grade: { id: string; name: string };
}

interface CommentParser {
  safeParse: (
    value: unknown,
  ) =>
    | { success: true; data: { comment?: string | null } }
    | { success: false; error: { issues: readonly { message: string }[] } };
}

/** Las llamadas de un tipo de formato; el resto del flujo (comentario, firma, historial) es común. */
interface FormatApi<T extends ReviewableRecord> {
  noun: 'hoja' | 'anotación';
  get: (id: string) => Promise<ApiResult<T>>;
  reviews: (id: string) => Promise<ApiResult<Review[]>>;
  approve: (id: string, body: { comment?: string }) => Promise<ApiResult<T>>;
  returnRecord: (id: string, body: { comment: string }) => Promise<ApiResult<T>>;
  voidRecord: (id: string, reason: string) => Promise<ApiResult<T>>;
  approveSchema: CommentParser;
  returnSchema: CommentParser;
  submittedAt: (record: T) => Date | null;
}

export const NOTE_FORMAT: FormatApi<ObserverNote> = {
  noun: 'anotación',
  get: getNote,
  reviews: listNoteReviews,
  approve: approveNote,
  returnRecord: returnNote,
  voidRecord: voidNote,
  approveSchema: approveObserverNoteSchema,
  returnSchema: returnObserverNoteSchema,
  // La anotación no guarda fecha de envío: el historial solo muestra las decisiones.
  submittedAt: () => null,
};

export interface RecordWithReviews<T> {
  record: T;
  reviews: Review[];
  /** Coordinadora del grado del registro (quien lo revisa) o `null`. */
  coordinator: GradeCoordinator | null;
}

/** Un registro con su historial de revisión. */
export function useFormatReviewData<T extends ReviewableRecord>(
  format: FormatApi<T>,
  id: string,
  key: string,
): Remote<RecordWithReviews<T>> {
  return useRemote(async () => {
    const [record, reviews, grades] = await Promise.all([
      format.get(id),
      format.reviews(id),
      listGrades(),
    ]);
    if (!record.ok) {
      return record;
    }
    if (!reviews.ok) {
      return reviews;
    }
    if (!grades.ok) {
      return grades;
    }
    return {
      ok: true,
      data: {
        record: record.data,
        reviews: reviews.data,
        coordinator: coordinatorOfGrade(grades.data, record.data.grade.id),
      },
    };
  }, `${key}:${id}`);
}

interface UseFormatReviewOptions<T extends ReviewableRecord> {
  format: FormatApi<T>;
  record: T;
  reviews: Review[];
  coordinator: GradeCoordinator | null;
  refresh: () => Promise<ApiError | null>;
}

/**
 * Decisiones de coordinación sobre un diario o una anotación: observaciones, devolver, marcar
 * revisada (queda firmada por quien revisa: es el revisor de la fila de decisión) y anular.
 */
export function useFormatReview<T extends ReviewableRecord>({
  format,
  record,
  reviews,
  coordinator,
  refresh,
}: UseFormatReviewOptions<T>) {
  const { state: session } = useSession();
  const user = session.status === 'authenticated' ? session.user : null;
  const [comment, setComment] = useState('');
  const [notice, setNotice] = useState<ReviewNotice | null>(null);
  const [busy, setBusy] = useState<'approve' | 'return' | 'void' | null>(null);
  const busyRef = useRef(false);
  const lastDecision = useRef<'approve' | 'return'>('approve');

  const own = user !== null && record.teacher.id === user.id;
  // Solo la coordinadora del grado revisa: para el resto es «Solo consulta».
  const canReview = canReviewGrade(user, coordinator);
  const canDecide = canReview && record.status === RecordStatus.Submitted && !own;
  const blockedReason = canReview ? formatReadOnlyReason(record.status, own, format.noun) : null;
  const consultText = canReview
    ? null
    : consultNotice(
        user,
        coordinator,
        record.grade.name,
        format.noun === 'hoja' ? 'este diario' : 'esta anotación',
      );
  const excess = Math.max(0, comment.trim().length - REVIEW_COMMENT_MAX_LENGTH);
  const submittedAt = format.submittedAt(record);
  const history = useMemo(() => buildHistory(reviews, submittedAt), [reviews, submittedAt]);

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

  const run = useCallback(
    async (kind: 'approve' | 'return' | 'void', task: () => Promise<void>) => {
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
    },
    [],
  );

  /** Valida el comentario con el esquema de `@gns/shared` de cada tipo; `null` si no cabe. */
  const validated = useCallback(
    (kind: 'approve' | 'return'): string | null | false => {
      const schema = kind === 'approve' ? format.approveSchema : format.returnSchema;
      const parsed = schema.safeParse({ comment });
      if (!parsed.success) {
        setNotice({
          tone: kind === 'return' ? 'warning' : 'error',
          text: sentence(
            kind === 'return' && comment.trim() === ''
              ? 'Escribe las observaciones de coordinación para devolver.'
              : (parsed.error.issues[0]?.message ?? 'El comentario no es válido.'),
          ),
        });
        return false;
      }
      return parsed.data.comment ?? null;
    },
    [comment, format],
  );

  const approve = useCallback(async () => {
    if (!canDecide) {
      return;
    }
    const value = validated('approve');
    if (value === false) {
      return;
    }
    lastDecision.current = 'approve';
    await run('approve', async () => {
      const result = await format.approve(record.id, value ? { comment: value } : {});
      if (!result.ok) {
        fail(result.error);
        return;
      }
      setComment('');
      await refresh();
      setNotice({
        tone: 'success',
        text: `Marcaste ${format.noun === 'hoja' ? 'la hoja' : 'la anotación'} como revisada. Queda firmada con tu nombre.`,
      });
      window.scrollTo({ top: 0 });
    });
  }, [canDecide, fail, format, record.id, refresh, run, validated]);

  /** Valida lo escrito antes de abrir la confirmación; devuelve si se puede abrir. */
  const canReturn = useCallback((): boolean => validated('return') !== false, [validated]);

  const confirmReturn = useCallback(async () => {
    if (!canDecide) {
      return;
    }
    const value = validated('return');
    if (value === false || value === null) {
      return;
    }
    lastDecision.current = 'return';
    await run('return', async () => {
      const result = await format.returnRecord(record.id, { comment: value });
      if (!result.ok) {
        fail(result.error);
        return;
      }
      setComment('');
      await refresh();
      setNotice({
        tone: 'success',
        text: `Devolviste ${format.noun === 'hoja' ? 'la hoja' : 'la anotación'} con observaciones. Queda firmado con tu nombre.`,
      });
      window.scrollTo({ top: 0 });
    });
  }, [canDecide, fail, format, record.id, refresh, run, validated]);

  const voidWithReason = useCallback(
    async (reason: string): Promise<string | null> => {
      let failure: string | null = null;
      await run('void', async () => {
        const result = await format.voidRecord(record.id, reason);
        if (!result.ok) {
          failure = result.error.message;
          return;
        }
        await refresh();
        setNotice({ tone: 'success', text: 'Registro anulado. Queda constancia del motivo.' });
        window.scrollTo({ top: 0 });
      });
      return failure;
    },
    [format, record.id, refresh, run],
  );

  const retryLast = useCallback(
    () => (lastDecision.current === 'approve' ? approve() : confirmReturn()),
    [approve, confirmReturn],
  );

  return {
    comment,
    setComment,
    excess,
    canDecide,
    canReview,
    consultText,
    blockedReason,
    notice,
    busy,
    history,
    userName: user?.fullName ?? '',
    approve,
    canReturn,
    confirmReturn,
    voidWithReason,
    retryLast,
  };
}

export type FormatReview = ReturnType<typeof useFormatReview>;
