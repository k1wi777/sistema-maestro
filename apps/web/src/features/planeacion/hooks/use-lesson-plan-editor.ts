import type { LessonPlan, LessonPlanResource } from '@gns/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ApiError, ApiResult } from '@/shared/api';
import type { SaveState } from '@/shared/ui';

import {
  addLessonPlanResource,
  removeLessonPlanResource,
  submitLessonPlan,
  updateLessonPlan,
  voidLessonPlan,
  type CreateResourceBody,
} from '../api/lesson-plans';
import {
  buildPatch,
  dirtyFields,
  mapApiErrors,
  toFormValues,
  type FormErrors,
  type FormField,
  type FormValues,
} from '../model/form-state';
import { isEditable } from '@/shared/records';

/** Respuesta 409 de la API: la planeación ya no está en un estado que admita el cambio. */
const CONFLICT_STATUS = 409;
const VALIDATION_STATUS = 400;

export interface SaveOutcome {
  ok: boolean;
  /** Errores por campo (400 o validación local) para llevar al docente al campo. */
  errors: FormErrors;
}

export interface SubmitOutcome {
  ok: boolean;
  errors: FormErrors;
  message?: string;
}

export interface LessonPlanEditorState {
  plan: LessonPlan;
  draft: FormValues;
  errors: FormErrors;
  editable: boolean;
  dirty: boolean;
  saveState: SaveState;
  savedAt: Date | null;
  /** Motivo del último guardado fallido; `null` si el último guardado fue bien. */
  saveError: string | null;
  /** Última planeación guardada, también tras un `await` (sin esperar a un nuevo render). */
  getPlan: () => LessonPlan;
  setField: (field: FormField, value: string) => void;
  /** Guarda los campos modificados; sin cambios no envía ninguna petición. */
  save: () => Promise<SaveOutcome>;
  /** Guarda lo pendiente y envía a coordinación. */
  submit: () => Promise<SubmitOutcome>;
  voidPlan: (reason: string) => Promise<ApiResult<LessonPlan>>;
  addResource: (body: CreateResourceBody) => Promise<ApiResult<LessonPlanResource>>;
  removeResource: (resourceId: string) => Promise<ApiResult<undefined>>;
}

interface Options {
  initial: LessonPlan;
  /** Se llama cuando la API responde 409: la planeación cambió de estado en el servidor. */
  onConflict: () => void;
}

function failureText(error: ApiError): string {
  return error.message;
}

/**
 * Estado del editor: la planeación guardada (`plan`) y el borrador que el docente escribe
 * (`draft`). `save()` envía solo los campos modificados (parcial) y se serializa: un solo guardado
 * en vuelo, y los que se piden mientras tanto se encadenan y reevalúan lo pendiente al ejecutarse,
 * de modo que no se envían peticiones repetidas ni se pisan entre sí. Ante un fallo el borrador se
 * conserva tal cual.
 */
export function useLessonPlanEditor({ initial, onConflict }: Options): LessonPlanEditorState {
  const [plan, setPlanState] = useState(initial);
  const [draft, setDraftState] = useState(() => toFormValues(initial));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const planRef = useRef(initial);
  const draftRef = useRef(draft);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const conflictRef = useRef(onConflict);

  useEffect(() => {
    conflictRef.current = onConflict;
  });

  const updatePlan = useCallback((next: LessonPlan) => {
    planRef.current = next;
    setPlanState(next);
  }, []);

  const savedValues = useMemo(() => toFormValues(plan), [plan]);
  const dirty = dirtyFields(savedValues, draft).length > 0;
  const editable = isEditable(plan.status);

  const getPlan = useCallback(() => planRef.current, []);

  const setField = useCallback((field: FormField, value: string) => {
    draftRef.current = { ...draftRef.current, [field]: value };
    setDraftState(draftRef.current);
    setErrors((previous) => {
      if (!previous[field]) {
        return previous;
      }
      const next = { ...previous };
      delete next[field];
      return next;
    });
    setSaveState((previous) => (previous === 'saved' ? 'idle' : previous));
  }, []);

  const performSave = useCallback(async (): Promise<SaveOutcome> => {
    const current = planRef.current;
    if (!isEditable(current.status)) {
      return { ok: true, errors: {} };
    }
    const patch = buildPatch(toFormValues(current), draftRef.current);
    if (patch.kind === 'unchanged') {
      return { ok: true, errors: {} };
    }
    if (patch.kind === 'invalid') {
      setErrors(patch.errors);
      setSaveState('error');
      setSaveError('Revisa los campos marcados: hay datos que no se pueden guardar.');
      return { ok: false, errors: patch.errors };
    }

    setSaveState('saving');
    const result = await updateLessonPlan(current.id, patch.body);
    if (result.ok) {
      updatePlan(result.data);
      setErrors({});
      setSavedAt(new Date());
      setSaveError(null);
      setSaveState('saved');
      return { ok: true, errors: {} };
    }
    if (result.error.statusCode === CONFLICT_STATUS) {
      setSaveState('error');
      setSaveError(failureText(result.error));
      conflictRef.current();
      return { ok: false, errors: {} };
    }
    const mapped = mapApiErrors(
      result.error.statusCode === VALIDATION_STATUS ? result.error.errors : undefined,
    );
    setErrors(mapped.fields);
    setSaveState('error');
    setSaveError(mapped.other[0] ?? failureText(result.error));
    return { ok: false, errors: mapped.fields };
  }, [updatePlan]);

  const save = useCallback((): Promise<SaveOutcome> => {
    const run = queueRef.current.then(performSave);
    queueRef.current = run.catch(() => undefined);
    return run;
  }, [performSave]);

  const submit = useCallback(async (): Promise<SubmitOutcome> => {
    const saved = await save();
    if (!saved.ok) {
      return { ok: false, errors: saved.errors };
    }
    const result = await submitLessonPlan(planRef.current.id);
    if (result.ok) {
      updatePlan(result.data);
      draftRef.current = toFormValues(result.data);
      setDraftState(draftRef.current);
      setErrors({});
      return { ok: true, errors: {} };
    }
    if (result.error.statusCode === CONFLICT_STATUS) {
      conflictRef.current();
      return { ok: false, errors: {}, message: failureText(result.error) };
    }
    const mapped = mapApiErrors(
      result.error.statusCode === VALIDATION_STATUS ? result.error.errors : undefined,
    );
    setErrors(mapped.fields);
    return {
      ok: false,
      errors: mapped.fields,
      message: mapped.other[0] ?? failureText(result.error),
    };
  }, [save, updatePlan]);

  const voidPlan = useCallback(
    async (reason: string): Promise<ApiResult<LessonPlan>> => {
      const result = await voidLessonPlan(planRef.current.id, reason);
      if (result.ok) {
        updatePlan(result.data);
        draftRef.current = toFormValues(result.data);
        setDraftState(draftRef.current);
        setErrors({});
        setSaveError(null);
      } else if (result.error.statusCode === CONFLICT_STATUS) {
        conflictRef.current();
      }
      return result;
    },
    [updatePlan],
  );

  const addResource = useCallback(
    async (body: CreateResourceBody): Promise<ApiResult<LessonPlanResource>> => {
      const result = await addLessonPlanResource(planRef.current.id, body);
      if (result.ok) {
        updatePlan({
          ...planRef.current,
          linkedResources: [...planRef.current.linkedResources, result.data],
        });
      } else if (result.error.statusCode === CONFLICT_STATUS) {
        conflictRef.current();
      }
      return result;
    },
    [updatePlan],
  );

  const removeResource = useCallback(
    async (resourceId: string): Promise<ApiResult<undefined>> => {
      const result = await removeLessonPlanResource(planRef.current.id, resourceId);
      if (result.ok) {
        updatePlan({
          ...planRef.current,
          linkedResources: planRef.current.linkedResources.filter(
            (resource) => resource.id !== resourceId,
          ),
        });
      } else if (result.error.statusCode === CONFLICT_STATUS) {
        conflictRef.current();
      }
      return result;
    },
    [updatePlan],
  );

  // El navegador avisa si se cierra la pestaña con cambios sin guardar (la navegación interna del
  // App Router no se puede interceptar: por eso se guarda en cada cambio de paso).
  useEffect(() => {
    if (!dirty || !editable) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, editable]);

  return {
    plan,
    draft,
    errors,
    editable,
    dirty,
    saveState,
    savedAt,
    saveError,
    getPlan,
    setField,
    save,
    submit,
    voidPlan,
    addResource,
    removeResource,
  };
}
