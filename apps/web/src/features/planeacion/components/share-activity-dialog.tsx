import {
  SHARED_ACTIVITY_CORNER_MAX_LENGTH,
  SHARED_ACTIVITY_MAX_DURATION_MINUTES,
  SHARED_ACTIVITY_TEXT_MAX_LENGTH,
  SHARED_ACTIVITY_TITLE_MAX_LENGTH,
  type SharedActivity,
} from '@gns/shared';
import { useId, useState } from 'react';

import type { ApiError } from '@/shared/api';
import { Button, Dialog, Notice, Select, TextArea, TextInput } from '@/shared/ui';

import { createSharedActivity, updateSharedActivity } from '../api/shared-activities';
import { readyOr, useActivityCatalogs } from '../hooks/use-activity-catalogs';
import {
  EMPTY_ACTIVITY_FORM,
  activityToFormValues,
  buildCreateBody,
  buildUpdateBody,
  isActivityField,
  type ActivityErrors,
  type ActivityFormValues,
} from '../model/activity-form';
import { ACTIVITY_TYPE_OPTIONS } from '../model/activity-types';
import { PrivacyNotice } from './privacy-notice';
import styles from './share-activity-dialog.module.css';

export type ShareActivityMode =
  | {
      kind: 'create';
      /** Valores de partida (p. ej. los de una planeación); sin ellos, el formulario va vacío. */
      initial?: ActivityFormValues;
      /** Avisos para el docente antes de publicar (textos recortados, etc.). */
      notes?: string[];
    }
  | { kind: 'edit'; activity: SharedActivity };

interface ShareActivityDialogProps {
  mode: ShareActivityMode;
  onClose: () => void;
  /** Se llama con la actividad guardada; `null` si editar no cambió nada. */
  onSaved: (activity: SharedActivity | null, kind: 'create' | 'edit') => void;
}

/** 400 de la API con errores por campo; el resto cae al aviso general del formulario. */
const VALIDATION_STATUS = 400;

/**
 * Compartir una actividad con la comunidad (crear) o editar una propia. El grado ofrecido es el del
 * nivel elegido («Todo el nivel» es el valor vacío) y al editar solo se envían los campos modificados.
 */
export function ShareActivityDialog({ mode, onClose, onSaved }: ShareActivityDialogProps) {
  const formId = useId();
  const cornersId = useId();
  const original = mode.kind === 'edit' ? activityToFormValues(mode.activity) : null;
  const [values, setValues] = useState<ActivityFormValues>(
    mode.kind === 'edit'
      ? activityToFormValues(mode.activity)
      : (mode.initial ?? EMPTY_ACTIVITY_FORM),
  );
  const [errors, setErrors] = useState<ActivityErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const catalogs = useActivityCatalogs(values.levelId || undefined);

  const levelOptions = readyOr(catalogs.levels).map((level) => ({
    value: level.id,
    label: level.name,
  }));
  const gradeOptions = [...readyOr(catalogs.grades)]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((grade) => ({ value: grade.id, label: grade.name }));
  const areaOptions = readyOr(catalogs.areas).map((area) => ({ value: area.id, label: area.name }));
  const corners = readyOr(catalogs.corners);

  function change(patch: Partial<ActivityFormValues>) {
    setValues((previous) => ({ ...previous, ...patch }));
    setErrors((previous) => {
      const next = { ...previous };
      for (const key of Object.keys(patch) as (keyof ActivityFormValues)[]) {
        delete next[key];
      }
      return next;
    });
  }

  async function handleSubmit() {
    setFailure(null);
    if (mode.kind === 'edit' && original) {
      const built = buildUpdateBody(original, values);
      if (built.kind === 'invalid') {
        setErrors(built.errors);
        return;
      }
      if (built.kind === 'unchanged') {
        onSaved(null, 'edit');
        return;
      }
      setBusy(true);
      const result = await updateSharedActivity(mode.activity.id, built.body);
      setBusy(false);
      if (result.ok) {
        onSaved(result.data, 'edit');
      } else {
        reportFailure(result.error);
      }
      return;
    }
    const built = buildCreateBody(values);
    if (built.kind !== 'body') {
      if (built.kind === 'invalid') {
        setErrors(built.errors);
      }
      return;
    }
    setBusy(true);
    const result = await createSharedActivity(built.body);
    setBusy(false);
    if (result.ok) {
      onSaved(result.data, 'create');
    } else {
      reportFailure(result.error);
    }
  }

  function reportFailure(error: ApiError) {
    const fieldErrors = 'errors' in error ? error.errors : undefined;
    const found: ActivityErrors = {};
    const other: string[] = [];
    if (error.statusCode === VALIDATION_STATUS) {
      for (const { field, reason } of fieldErrors ?? []) {
        if (isActivityField(field)) {
          found[field] ??= reason;
        } else {
          other.push(reason);
        }
      }
    }
    setErrors(found);
    setFailure(
      Object.keys(found).length > 0 && other.length === 0 ? null : (other[0] ?? error.message),
    );
  }

  const editing = mode.kind === 'edit';

  return (
    <Dialog
      open
      wide
      title={editing ? 'Editar actividad' : 'Compartir una actividad'}
      description={
        editing
          ? 'Los cambios los verán todos los docentes.'
          : 'Revisa el contenido antes de publicar: todos los docentes verán esta actividad.'
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={busy}>
            {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Publicar en el repositorio'}
          </Button>
        </>
      }
    >
      {mode.kind === 'create' && mode.notes && mode.notes.length > 0 ? (
        <Notice tone="warning">{mode.notes.join(' ')}</Notice>
      ) : null}
      <form
        id={formId}
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <div className={styles.full}>
          <TextInput
            label="Nombre de la actividad"
            required
            maxLength={SHARED_ACTIVITY_TITLE_MAX_LENGTH}
            placeholder="Ej. Mercado de frutas en Supermarket"
            value={values.title}
            error={errors.title}
            onChange={(event) => change({ title: event.target.value })}
          />
        </div>
        <div className={styles.full}>
          <TextArea
            label="Objetivo"
            maxLength={SHARED_ACTIVITY_TEXT_MAX_LENGTH}
            placeholder="¿Qué habilidad o competencia desarrolla?"
            value={values.objective}
            error={errors.objective}
            onChange={(event) => change({ objective: event.target.value })}
          />
        </div>
        <Select
          label="Tipo"
          options={ACTIVITY_TYPE_OPTIONS}
          value={values.activityType}
          error={errors.activityType}
          onChange={(event) =>
            change({ activityType: event.target.value as ActivityFormValues['activityType'] })
          }
        />
        <Select
          label="Nivel"
          placeholder="Todos los niveles"
          options={levelOptions}
          value={values.levelId}
          error={errors.levelId}
          onChange={(event) => change({ levelId: event.target.value, gradeId: '' })}
        />
        <Select
          label="Grado"
          placeholder="Todo el nivel"
          options={gradeOptions}
          value={values.gradeId}
          disabled={!values.levelId}
          help={values.levelId ? undefined : 'Elige un nivel para escoger un grado.'}
          error={errors.gradeId}
          onChange={(event) => change({ gradeId: event.target.value })}
        />
        <Select
          label="Dimensión o asignatura"
          placeholder="Todas las áreas"
          options={areaOptions}
          value={values.areaId}
          error={errors.areaId}
          onChange={(event) => change({ areaId: event.target.value })}
        />
        <div>
          <TextInput
            label="Rincón o zona"
            maxLength={SHARED_ACTIVITY_CORNER_MAX_LENGTH}
            list={cornersId}
            placeholder="Ej. Sweet Home"
            value={values.learningCorner}
            error={errors.learningCorner}
            onChange={(event) => change({ learningCorner: event.target.value })}
          />
          <datalist id={cornersId}>
            {corners.map((corner) => (
              <option key={corner} value={corner} />
            ))}
          </datalist>
        </div>
        <TextInput
          label="Duración (minutos)"
          type="number"
          inputMode="numeric"
          min={1}
          max={SHARED_ACTIVITY_MAX_DURATION_MINUTES}
          value={values.durationMinutes}
          error={errors.durationMinutes}
          onChange={(event) => change({ durationMinutes: event.target.value })}
        />
        <div className={styles.full}>
          <TextArea
            label="Materiales"
            maxLength={SHARED_ACTIVITY_TEXT_MAX_LENGTH}
            value={values.materials}
            error={errors.materials}
            onChange={(event) => change({ materials: event.target.value })}
          />
        </div>
        <div className={styles.full}>
          <TextArea
            label="Paso a paso"
            required
            maxLength={SHARED_ACTIVITY_TEXT_MAX_LENGTH}
            placeholder="1. … 2. … 3. …"
            value={values.steps}
            error={errors.steps}
            onChange={(event) => change({ steps: event.target.value })}
          />
        </div>
        <div className={styles.full}>
          <TextInput
            label="Enlace al recurso (opcional)"
            type="url"
            inputMode="url"
            placeholder="Canva, Liveworksheets, Kahoot, video…"
            value={values.link}
            error={errors.link}
            onChange={(event) => change({ link: event.target.value })}
          />
        </div>
        <div className={styles.full}>
          <PrivacyNotice context="share" />
        </div>
        {failure ? (
          <div className={styles.full}>
            <Notice tone="error">{failure}</Notice>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
