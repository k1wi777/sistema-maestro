'use client';

import type {
  FieldJournal,
  FieldJournalDay,
  FieldJournalSummary,
  JournalStatus,
  TodayJournals,
} from '@gns/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError, ApiResult } from '@/shared/api';
import { usePagedList, useRemote, type PagedList, type Remote } from '@/shared/data';

import {
  addAnnotation,
  discardAnnotation,
  getJournalDay,
  getTodayJournals,
  listFieldJournals,
  markAnnotationDraft,
  markAnnotationReady,
  resubmitFieldJournal,
  submitFieldJournal,
  updateAnnotation,
  voidFieldJournal,
  type CreateAnnotationBody,
  type UpdateAnnotationBody,
} from '../api/field-journals';
import { mapAnnotationApiErrors, type AnnotationField } from '../model/annotation-form';
import type { FieldErrors } from '../model/messages';

const PAGE_SIZE = 20;

/** Bloque «Hoy»: el diario de hoy de cada grupo del docente. */
export function useTodayJournals(): Remote<TodayJournals> {
  return useRemote(getTodayJournals, 'journals-today');
}

/** Diarios de los grupos del docente, con filtros por estado y grupo y «Cargar más». */
export function useJournalList(
  status: JournalStatus | undefined,
  groupId: string | undefined,
): PagedList<FieldJournalSummary> {
  return usePagedList<FieldJournalSummary>(
    (page) => listFieldJournals({ scope: 'mine', status, groupId, page, pageSize: PAGE_SIZE }),
    JSON.stringify(['mine', status, groupId]),
  );
}

/** El diario de un grupo y fecha (vacío si nadie ha anotado todavía). */
export function useJournalDay(groupId: string, date: string): Remote<FieldJournalDay> {
  return useRemote(() => getJournalDay(groupId, date), `journal-day:${groupId}:${date}`);
}

/** Respuesta 409: el diario cambió de estado en el servidor (p. ej. coordinación lo devolvió). */
const CONFLICT_STATUS = 409;

export type JournalOutcome =
  | {
      ok: true;
      /** Id de la anotación recién creada, si la operación fue un alta. */ createdId?: string;
    }
  | { ok: false; message: string; fields: FieldErrors<AnnotationField>['fields'] };

interface UseJournalEditorOptions {
  initial: FieldJournalDay;
  /** Se llama ante un 409 para que la pantalla vuelva a pedir el diario con su estado actual. */
  onConflict: () => void;
}

/**
 * Estado y acciones del diario abierto. Cada escritura devuelve el diario completo y sustituye el
 * que se muestra, sin volver a pedirlo.
 */
export function useJournalEditor({ initial, onConflict }: UseJournalEditorOptions) {
  const [journal, setJournal] = useState<FieldJournalDay>(initial);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const journalRef = useRef(journal);
  useEffect(() => {
    journalRef.current = journal;
  });

  const failure = useCallback(
    (error: ApiError): JournalOutcome => {
      if (error.statusCode === CONFLICT_STATUS) {
        onConflict();
      }
      const mapped = mapAnnotationApiErrors(error.statusCode === 400 ? error.errors : undefined);
      const hasFields = Object.keys(mapped.fields).length > 0;
      return {
        ok: false,
        message: hasFields ? '' : (mapped.other[0] ?? error.message),
        fields: mapped.fields,
      };
    },
    [onConflict],
  );

  const accept = useCallback((next: FieldJournalDay): JournalOutcome => {
    setJournal(next);
    setSavedAt(new Date());
    return { ok: true };
  }, []);

  const run = useCallback(
    async (task: () => Promise<ApiResult<FieldJournal>>): Promise<JournalOutcome> => {
      const result = await task();
      return result.ok ? accept(result.data) : failure(result.error);
    },
    [accept, failure],
  );

  const create = useCallback(
    async (body: CreateAnnotationBody): Promise<JournalOutcome> => {
      const before = new Set(journalRef.current.annotations.map((annotation) => annotation.id));
      const result = await addAnnotation(body);
      if (!result.ok) {
        return failure(result.error);
      }
      accept(result.data);
      const created = result.data.annotations.find(
        (annotation) => annotation.isMine && !before.has(annotation.id),
      );
      return { ok: true, createdId: created?.id };
    },
    [accept, failure],
  );

  const update = useCallback(
    (annotationId: string, body: UpdateAnnotationBody) =>
      run(() => updateAnnotation(journalRef.current.id ?? '', annotationId, body)),
    [run],
  );

  const markReady = useCallback(
    (annotationId: string) =>
      run(() => markAnnotationReady(journalRef.current.id ?? '', annotationId)),
    [run],
  );

  const markDraft = useCallback(
    (annotationId: string) =>
      run(() => markAnnotationDraft(journalRef.current.id ?? '', annotationId)),
    [run],
  );

  /**
   * Borra la anotación en borrador y vuelve a pedir el día: si era la única, el diario también se
   * borró y el día llega sin diario (`id: null`).
   */
  const discard = useCallback(
    async (annotationId: string): Promise<JournalOutcome> => {
      const result = await discardAnnotation(annotationId);
      if (!result.ok) {
        return failure(result.error);
      }
      const { group, date } = journalRef.current;
      const day = await getJournalDay(group.id, date);
      return day.ok ? accept(day.data) : failure(day.error);
    },
    [accept, failure],
  );

  const submit = useCallback(
    (resubmit: boolean) =>
      run(() =>
        resubmit
          ? resubmitFieldJournal(journalRef.current.id ?? '')
          : submitFieldJournal(journalRef.current.id ?? ''),
      ),
    [run],
  );

  const voidJournal = useCallback(
    (reason: string) => run(() => voidFieldJournal(journalRef.current.id ?? '', reason)),
    [run],
  );

  return {
    journal,
    savedAt,
    create,
    update,
    markReady,
    markDraft,
    discard,
    submit,
    voidJournal,
  };
}
