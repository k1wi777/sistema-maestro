'use client';

import type { FieldJournal, Review } from '@gns/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError, ApiResult } from '@/shared/api';
import { useRemote, type Remote } from '@/shared/data';
import { isEditable } from '@/shared/records';

import {
  addJournalEntry,
  getFieldJournal,
  listFieldJournalReviews,
  removeJournalEntry,
  submitFieldJournal,
  updateJournalEntry,
  voidFieldJournal,
  type CreateJournalEntryBody,
  type UpdateJournalEntryBody,
} from '../api/field-journals';
import { mapEntryApiErrors, type EntryField } from '../model/journal-entry-form';
import type { FieldErrors } from '../model/messages';

export interface JournalWithReviews {
  journal: FieldJournal;
  reviews: Review[];
}

async function loadJournal(id: string): Promise<ApiResult<JournalWithReviews>> {
  const [journal, reviews] = await Promise.all([getFieldJournal(id), listFieldJournalReviews(id)]);
  if (!journal.ok) {
    return journal;
  }
  // Sin historial la hoja se usa igual: solo faltaría la sección de revisión.
  return { ok: true, data: { journal: journal.data, reviews: reviews.ok ? reviews.data : [] } };
}

/** Una hoja del diario con su historial de revisión de coordinación. */
export function useFieldJournal(id: string): Remote<JournalWithReviews> {
  return useRemote(() => loadJournal(id), `field-journal:${id}`);
}

/** Respuesta 409: la hoja cambió de estado en el servidor (p. ej. coordinación la devolvió). */
const CONFLICT_STATUS = 409;

export type JournalOutcome =
  { ok: true } | { ok: false; message: string; fields: FieldErrors<EntryField>['fields'] };

interface UseJournalEditorOptions {
  initial: FieldJournal;
  /** Se llama ante un 409 para que la pantalla vuelva a pedir la hoja con su estado actual. */
  onConflict: () => void;
}

/**
 * Estado y acciones de una hoja abierta. Cada escritura de un registro devuelve la hoja completa y
 * sustituye la que se muestra, sin volver a pedirla; tras enviar o anular se recarga el historial.
 */
export function useJournalEditor({ initial, onConflict }: UseJournalEditorOptions) {
  const [journal, setJournal] = useState(initial);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const journalRef = useRef(journal);
  useEffect(() => {
    journalRef.current = journal;
  });
  const editable = isEditable(journal.status);

  const failure = useCallback(
    (error: ApiError): JournalOutcome => {
      if (error.statusCode === CONFLICT_STATUS) {
        onConflict();
      }
      const mapped = mapEntryApiErrors(error.statusCode === 400 ? error.errors : undefined);
      const hasFields = Object.keys(mapped.fields).length > 0;
      return {
        ok: false,
        message: hasFields ? '' : (mapped.other[0] ?? error.message),
        fields: mapped.fields,
      };
    },
    [onConflict],
  );

  const accept = useCallback((next: FieldJournal): JournalOutcome => {
    setJournal(next);
    setSavedAt(new Date());
    return { ok: true };
  }, []);

  const addEntry = useCallback(
    async (body: CreateJournalEntryBody): Promise<JournalOutcome> => {
      const result = await addJournalEntry(journalRef.current.id, body);
      return result.ok ? accept(result.data) : failure(result.error);
    },
    [accept, failure],
  );

  const updateEntry = useCallback(
    async (entryId: string, body: UpdateJournalEntryBody): Promise<JournalOutcome> => {
      const result = await updateJournalEntry(journalRef.current.id, entryId, body);
      return result.ok ? accept(result.data) : failure(result.error);
    },
    [accept, failure],
  );

  const removeEntry = useCallback(
    async (entryId: string): Promise<JournalOutcome> => {
      const result = await removeJournalEntry(journalRef.current.id, entryId);
      return result.ok ? accept(result.data) : failure(result.error);
    },
    [accept, failure],
  );

  const refreshReviews = useCallback(async () => {
    const result = await listFieldJournalReviews(journalRef.current.id);
    if (result.ok) {
      setReviews(result.data);
    }
  }, []);

  const submit = useCallback(async (): Promise<JournalOutcome> => {
    const result = await submitFieldJournal(journalRef.current.id);
    if (!result.ok) {
      return failure(result.error);
    }
    setJournal(result.data);
    await refreshReviews();
    return { ok: true };
  }, [failure, refreshReviews]);

  const voidJournal = useCallback(
    async (reason: string): Promise<JournalOutcome> => {
      const result = await voidFieldJournal(journalRef.current.id, reason);
      if (!result.ok) {
        return failure(result.error);
      }
      setJournal(result.data);
      await refreshReviews();
      return { ok: true };
    },
    [failure, refreshReviews],
  );

  return {
    journal,
    /** `null` hasta que una acción recarga el historial: mientras tanto manda el cargado con la hoja. */
    reviews,
    editable,
    savedAt,
    addEntry,
    updateEntry,
    removeEntry,
    submit,
    voidJournal,
  };
}
