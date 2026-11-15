'use client';

import type { ObserverNote, Review } from '@gns/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError, ApiResult } from '@/shared/api';
import { useRemote, type Remote } from '@/shared/data';
import { isEditable } from '@/shared/records';

import {
  getObserverNote,
  listObserverNoteReviews,
  submitObserverNote,
  updateObserverNote,
  voidObserverNote,
  type UpdateObserverNoteBody,
} from '../api/observer-notes';
import type { FieldErrors } from '../model/messages';
import { mapNoteApiErrors, type NoteField } from '../model/observer-note-form';

export interface NoteWithReviews {
  note: ObserverNote;
  reviews: Review[];
}

async function loadNote(id: string): Promise<ApiResult<NoteWithReviews>> {
  const [note, reviews] = await Promise.all([getObserverNote(id), listObserverNoteReviews(id)]);
  if (!note.ok) {
    return note;
  }
  // Sin historial la anotación se usa igual: solo faltaría el comentario de coordinación.
  return { ok: true, data: { note: note.data, reviews: reviews.ok ? reviews.data : [] } };
}

/** Una anotación con su historial de revisión de coordinación. */
export function useObserverNote(id: string): Remote<NoteWithReviews> {
  return useRemote(() => loadNote(id), `observer-note:${id}`);
}

/** Respuesta 409: la anotación cambió de estado en el servidor. */
const CONFLICT_STATUS = 409;

export type NoteOutcome =
  { ok: true } | { ok: false; message: string; fields: FieldErrors<NoteField>['fields'] };

interface UseNoteEditorOptions {
  initial: ObserverNote;
  /** Se llama ante un 409 para que la pantalla vuelva a pedir la anotación con su estado actual. */
  onConflict: () => void;
}

/** Estado y acciones de una anotación abierta: guardar cambios, enviar y anular. */
export function useNoteEditor({ initial, onConflict }: UseNoteEditorOptions) {
  const [note, setNote] = useState(initial);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const noteRef = useRef(note);
  useEffect(() => {
    noteRef.current = note;
  });

  const failure = useCallback(
    (error: ApiError): NoteOutcome => {
      if (error.statusCode === CONFLICT_STATUS) {
        onConflict();
      }
      const mapped = mapNoteApiErrors(error.statusCode === 400 ? error.errors : undefined);
      const hasFields = Object.keys(mapped.fields).length > 0;
      return {
        ok: false,
        message: hasFields ? '' : (mapped.other[0] ?? error.message),
        fields: mapped.fields,
      };
    },
    [onConflict],
  );

  const refreshReviews = useCallback(async () => {
    const result = await listObserverNoteReviews(noteRef.current.id);
    if (result.ok) {
      setReviews(result.data);
    }
  }, []);

  const save = useCallback(
    async (changes: UpdateObserverNoteBody): Promise<NoteOutcome> => {
      const result = await updateObserverNote(noteRef.current.id, changes);
      if (!result.ok) {
        return failure(result.error);
      }
      setNote(result.data);
      setSavedAt(new Date());
      return { ok: true };
    },
    [failure],
  );

  const submit = useCallback(async (): Promise<NoteOutcome> => {
    const result = await submitObserverNote(noteRef.current.id);
    if (!result.ok) {
      return failure(result.error);
    }
    setNote(result.data);
    await refreshReviews();
    return { ok: true };
  }, [failure, refreshReviews]);

  const voidNote = useCallback(
    async (reason: string): Promise<NoteOutcome> => {
      const result = await voidObserverNote(noteRef.current.id, reason);
      if (!result.ok) {
        return failure(result.error);
      }
      setNote(result.data);
      await refreshReviews();
      return { ok: true };
    },
    [failure, refreshReviews],
  );

  return {
    note,
    /** `null` hasta que una acción recarga el historial: mientras tanto manda el cargado con la anotación. */
    reviews,
    editable: isEditable(note.status),
    savedAt,
    save,
    submit,
    voidNote,
  };
}
