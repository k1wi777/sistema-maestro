'use client';

import type { Activity } from '@gns/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createActivity, updateActivity } from '../api/modules';
import {
  isDraftDirty,
  newDraft,
  toDraft,
  validateDraft,
  type ActivityDraft,
  type ActivityType,
  type DraftErrors,
} from '../model/activity-form';
import type { ModuleEditor } from './use-module-editor';

interface Session {
  /** `null` es una actividad nueva. */
  activityId: string | null;
  type: ActivityType;
  /** `null`: la configuración guardada no pasa el esquema y no se puede editar aquí. */
  draft: ActivityDraft | null;
  /** Lo guardado, para detectar cambios y para «Descartar cambios»; `null` en una nueva. */
  baseline: ActivityDraft | null;
}

export interface ActivityEditor {
  session: Session | null;
  errors: DraftErrors;
  /** Motivo del último guardado fallido de la actividad abierta. */
  failure: string | null;
  saving: boolean;
  dirty: boolean;
  /** Vista previa del borrador válido abierta dentro del formulario. */
  previewing: boolean;
  setDraft: (draft: ActivityDraft) => void;
  openExisting: (activity: Activity) => Promise<void>;
  openNew: (type: ActivityType) => Promise<void>;
  save: () => Promise<boolean>;
  discard: () => void;
  close: () => void;
  togglePreview: () => void;
}

function upsert(activities: Activity[], saved: Activity): Activity[] {
  const exists = activities.some((activity) => activity.id === saved.id);
  return exists
    ? activities.map((activity) => (activity.id === saved.id ? saved : activity))
    : [...activities, saved].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Una actividad abierta a la vez (nueva o existente). Abrir otra, agregar una o cambiar de paso
 * guarda primero la abierta si tiene cambios; si la validación o la API fallan, se queda abierta
 * con sus errores. Todo guardado pasa por la cola `track` del editor del módulo.
 */
export function useActivityEditor(editor: ModuleEditor): ActivityEditor {
  const { detail, track, updateDetail, registerSaver, setStepDirty } = editor;
  const [session, setSessionState] = useState<Session | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const sessionRef = useRef<Session | null>(null);

  const setSession = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);

  const dirty = useMemo(
    () => (session?.draft ? isDraftDirty(session.baseline, session.draft) : false),
    [session],
  );

  const save = useCallback(async (): Promise<boolean> => {
    const current = sessionRef.current;
    if (!current?.draft || !isDraftDirty(current.baseline, current.draft)) {
      return true;
    }
    const draft = current.draft;
    const validation = validateDraft(draft);
    if (!validation.ok) {
      setErrors(validation.errors);
      setFailure(null);
      return false;
    }
    setErrors({});
    setSaving(true);
    const moduleId = detail.id;
    const result = await track(() =>
      draft.id === null
        ? createActivity(moduleId, validation.create)
        : updateActivity(moduleId, draft.id, validation.update),
    );
    setSaving(false);
    if (!result.ok) {
      setFailure(result.error.message);
      return false;
    }
    setFailure(null);
    updateDetail((module) => ({ ...module, activities: upsert(module.activities, result.data) }));
    const saved = toDraft(result.data);
    if (saved.editable && sessionRef.current === current) {
      setSession({
        activityId: result.data.id,
        type: result.data.type,
        draft: saved.draft,
        baseline: saved.draft,
      });
    }
    return true;
  }, [detail.id, setSession, track, updateDetail]);

  const reset = useCallback(() => {
    setErrors({});
    setFailure(null);
    setPreviewing(false);
  }, []);

  const openExisting = useCallback(
    async (activity: Activity) => {
      if (sessionRef.current?.activityId === activity.id) {
        return;
      }
      if (!(await save())) {
        return;
      }
      reset();
      const result = toDraft(activity);
      setSession({
        activityId: activity.id,
        type: activity.type,
        draft: result.editable ? result.draft : null,
        baseline: result.editable ? result.draft : null,
      });
    },
    [reset, save, setSession],
  );

  const openNew = useCallback(
    async (type: ActivityType) => {
      if (!(await save())) {
        return;
      }
      reset();
      setSession({ activityId: null, type, draft: newDraft(type), baseline: null });
    },
    [reset, save, setSession],
  );

  const setDraft = useCallback(
    (draft: ActivityDraft) => {
      const current = sessionRef.current;
      if (current) {
        setSession({ ...current, draft });
        setErrors({});
        setFailure(null);
      }
    },
    [setSession],
  );

  const discard = useCallback(() => {
    const current = sessionRef.current;
    if (!current) {
      return;
    }
    reset();
    setSession(current.baseline ? { ...current, draft: current.baseline } : null);
  }, [reset, setSession]);

  const close = useCallback(() => {
    reset();
    setSession(null);
  }, [reset, setSession]);

  const togglePreview = useCallback(() => setPreviewing((value) => !value), []);

  useEffect(() => {
    registerSaver('actividades', { save });
    return () => registerSaver('actividades', null);
  }, [registerSaver, save]);

  useEffect(() => {
    setStepDirty('actividades', dirty);
    return () => setStepDirty('actividades', false);
  }, [dirty, setStepDirty]);

  return {
    session,
    errors,
    failure,
    saving,
    dirty,
    previewing,
    setDraft,
    openExisting,
    openNew,
    save,
    discard,
    close,
    togglePreview,
  };
}
