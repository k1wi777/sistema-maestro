'use client';

import type { TrainingModule, TrainingModuleDetail } from '@gns/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ApiResult } from '@/shared/api';
import { useRemote, type Remote } from '@/shared/data';
import type { SaveState } from '@/shared/ui';

import { getModuleDetail, updateModule } from '../api/modules';
import { changeModuleStatus, getPlanTree, type TrainingPlanTree } from '../api/plans';
import type { EditorStepId } from '../model/editor-steps';
import {
  DATA_STEP_FIELDS,
  MODULE_FORM_FIELDS,
  PRESENTATION_STEP_FIELDS,
  VIDEO_STEP_FIELDS,
  buildModulePatch,
  dirtyModuleFields,
  mapModuleApiErrors,
  toModuleFormValues,
  type ModuleFormErrors,
  type ModuleFormField,
  type ModuleFormValues,
} from '../model/module-form';

const VALIDATION_STATUS = 400;

export interface EditorData {
  detail: TrainingModuleDetail;
  tree: TrainingPlanTree;
}

async function loadEditorData(moduleId: string): Promise<ApiResult<EditorData>> {
  const detail = await getModuleDetail(moduleId);
  if (!detail.ok) {
    return detail;
  }
  const tree = await getPlanTree(detail.data.planId);
  return tree.ok ? { ok: true, data: { detail: detail.data, tree: tree.data } } : tree;
}

/** Módulo y árbol de su plan (nombre del plan y partes) para el editor. */
export function useModuleEditorData(moduleId: string): Remote<EditorData> {
  return useRemote(() => loadEditorData(moduleId), `gestion-formacion:module:${moduleId}`);
}

/** Lo que un paso con contenido propio (preguntas, diapositivas) ofrece para guardar al salir. */
export interface StepSaver {
  save: () => Promise<boolean>;
}

export interface ModuleEditor {
  detail: TrainingModuleDetail;
  tree: TrainingPlanTree;
  draft: ModuleFormValues;
  errors: ModuleFormErrors;
  saveState: SaveState;
  /** Motivo del último guardado fallido; `null` si el último guardado fue bien. */
  saveError: string | null;
  dirty: boolean;
  /** Mientras es verdadero (por ejemplo, subiendo un archivo) no se puede cambiar de paso. */
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setField: (field: ModuleFormField, value: string) => void;
  /** Guarda los campos modificados de `fields` en un solo `PATCH`; sin cambios no envía nada. */
  saveFields: (fields: readonly ModuleFormField[]) => Promise<boolean>;
  /** Guarda lo pendiente del paso: sus campos y, si lo declara, su guardador. */
  saveStep: (id: EditorStepId) => Promise<boolean>;
  registerSaver: (id: EditorStepId, saver: StepSaver | null) => void;
  setStepDirty: (id: EditorStepId, dirty: boolean) => void;
  /** Escribe en el módulo local lo que respondió la API (diapositivas, preguntas, actividades). */
  updateDetail: (update: (detail: TrainingModuleDetail) => TrainingModuleDetail) => void;
  /** Aplica el módulo que devolvió la API sin pisar lo que se está escribiendo en otros campos. */
  mergeModule: (module: TrainingModule) => void;
  /** Ejecuta una llamada a la API en la cola de guardado y refleja su resultado en el estado. */
  track: <T>(call: () => Promise<ApiResult<T>>) => Promise<ApiResult<T>>;
  publish: () => Promise<{ ok: boolean; message: string | null }>;
}

const STEP_FIELDS: Partial<Record<EditorStepId, readonly ModuleFormField[]>> = {
  datos: DATA_STEP_FIELDS,
  video: VIDEO_STEP_FIELDS,
  presentacion: PRESENTATION_STEP_FIELDS,
};

/**
 * Estado del editor de un módulo: lo guardado (`detail`) y el borrador de los campos de texto. Todo
 * guardado pasa por una sola cola (`track`), de modo que dos peticiones nunca se pisan. Ante un
 * fallo el borrador se conserva tal cual y el error queda junto al campo o en el aviso del paso.
 */
export function useModuleEditor(initial: EditorData): ModuleEditor {
  const [detail, setDetailState] = useState(initial.detail);
  const [draft, setDraftState] = useState(() => toModuleFormValues(initial.detail));
  const [errors, setErrors] = useState<ModuleFormErrors>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirtySteps, setDirtySteps] = useState<ReadonlySet<EditorStepId>>(new Set());

  const detailRef = useRef(initial.detail);
  const draftRef = useRef(draft);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const saversRef = useRef(new Map<EditorStepId, StepSaver>());

  const setDetail = useCallback((next: TrainingModuleDetail) => {
    detailRef.current = next;
    setDetailState(next);
  }, []);

  const setDraft = useCallback((next: ModuleFormValues) => {
    draftRef.current = next;
    setDraftState(next);
  }, []);

  const savedValues = useMemo(() => toModuleFormValues(detail), [detail]);
  const dirty =
    dirtyModuleFields(savedValues, draft, MODULE_FORM_FIELDS).length > 0 || dirtySteps.size > 0;

  const setField = useCallback(
    (field: ModuleFormField, value: string) => {
      setDraft({ ...draftRef.current, [field]: value });
      setErrors((previous) => {
        if (!previous[field]) {
          return previous;
        }
        const next = { ...previous };
        delete next[field];
        return next;
      });
      setSaveState((previous) => (previous === 'saved' ? 'idle' : previous));
    },
    [setDraft],
  );

  const track = useCallback(<T>(call: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> => {
    setSaveState('saving');
    const run = queueRef.current.then(call);
    queueRef.current = run.catch(() => undefined);
    return run.then((result) => {
      if (result.ok) {
        setSaveError(null);
        setSaveState('saved');
      } else {
        setSaveError(result.error.message);
        setSaveState('error');
      }
      return result;
    });
  }, []);

  const updateDetail = useCallback(
    (update: (detail: TrainingModuleDetail) => TrainingModuleDetail) => {
      setDetail(update(detailRef.current));
    },
    [setDetail],
  );

  const mergeModule = useCallback(
    (module: TrainingModule) => {
      const previous = toModuleFormValues(detailRef.current);
      const next = { ...detailRef.current, ...module };
      const incoming = toModuleFormValues(next);
      const current = draftRef.current;
      const untouched = new Set(dirtyModuleFields(previous, current, MODULE_FORM_FIELDS));
      const merged = { ...current };
      for (const field of MODULE_FORM_FIELDS) {
        if (!untouched.has(field)) {
          merged[field] = incoming[field];
        }
      }
      setDetail(next);
      setDraft(merged);
    },
    [setDetail, setDraft],
  );

  const saveFields = useCallback(
    async (fields: readonly ModuleFormField[]): Promise<boolean> => {
      const patch = buildModulePatch(
        toModuleFormValues(detailRef.current),
        draftRef.current,
        fields,
      );
      if (patch.kind === 'unchanged') {
        return true;
      }
      if (patch.kind === 'invalid') {
        setErrors(patch.errors);
        setSaveState('error');
        setSaveError('Revisa los campos marcados: hay datos que no se pueden guardar.');
        return false;
      }
      const moduleId = detailRef.current.id;
      const result = await track(() => updateModule(moduleId, patch.body));
      if (result.ok) {
        setErrors({});
        mergeModule(result.data);
        return true;
      }
      const mapped = mapModuleApiErrors(
        result.error.statusCode === VALIDATION_STATUS && 'errors' in result.error
          ? result.error.errors
          : undefined,
      );
      setErrors(mapped.fields);
      setSaveError(mapped.other[0] ?? result.error.message);
      return false;
    },
    [mergeModule, track],
  );

  const saveStep = useCallback(
    async (id: EditorStepId): Promise<boolean> => {
      const fields = STEP_FIELDS[id];
      if (fields && !(await saveFields(fields))) {
        return false;
      }
      const saver = saversRef.current.get(id);
      return saver ? saver.save() : true;
    },
    [saveFields],
  );

  const registerSaver = useCallback((id: EditorStepId, saver: StepSaver | null) => {
    if (saver) {
      saversRef.current.set(id, saver);
    } else {
      saversRef.current.delete(id);
    }
  }, []);

  const setStepDirty = useCallback((id: EditorStepId, isDirty: boolean) => {
    setDirtySteps((previous) => {
      if (previous.has(id) === isDirty) {
        return previous;
      }
      const next = new Set(previous);
      if (isDirty) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const publish = useCallback(async () => {
    const result = await changeModuleStatus(detailRef.current.id, 'publish');
    if (result.ok) {
      mergeModule(result.data);
      return { ok: true, message: null };
    }
    return { ok: false, message: result.error.message };
  }, [mergeModule]);

  // El navegador avisa si se cierra la pestaña con cambios sin guardar (la navegación interna del
  // App Router no se puede interceptar: por eso se guarda en cada cambio de paso).
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return {
    detail,
    tree: initial.tree,
    draft,
    errors,
    saveState,
    saveError,
    dirty,
    busy,
    setBusy,
    setField,
    saveFields,
    saveStep,
    registerSaver,
    setStepDirty,
    updateDetail,
    mergeModule,
    track,
    publish,
  };
}
