'use client';

import {
  JOURNAL_ACTIONS_MAX_LENGTH,
  JOURNAL_DESCRIPTION_MAX_LENGTH,
  JOURNAL_REFLECTION_MAX_LENGTH,
  JournalEventType,
  type JournalAnnotation,
  type JournalViewer,
} from '@gns/shared';
import { useState } from 'react';

import { Button, Notice, Select, TextArea, TextInput } from '@/shared/ui';

import type { CreateAnnotationBody, UpdateAnnotationBody } from '../api/field-journals';
import type { JournalOutcome } from '../hooks/use-field-journal';
import {
  buildAnnotationChanges,
  buildCreateAnnotation,
  emptyAnnotationValues,
  valuesFromAnnotation,
  type AnnotationErrors,
  type AnnotationFormValues,
} from '../model/annotation-form';
import { JOURNAL_EVENT_INFO, JOURNAL_EVENT_ORDER } from '../model/labels';
import styles from './record-screen.module.css';

const EVENT_OPTIONS = JOURNAL_EVENT_ORDER.map((type) => ({
  value: type,
  label: JOURNAL_EVENT_INFO[type].label,
}));

interface AnnotationFormProps {
  groupId: string;
  date: string;
  areas: JournalViewer['areas'];
  /** Anotación que se edita; sin ella, el formulario agrega una nueva. */
  annotation?: JournalAnnotation;
  onCreate: (body: CreateAnnotationBody) => Promise<JournalOutcome>;
  onUpdate: (annotationId: string, changes: UpdateAnnotationBody) => Promise<JournalOutcome>;
  /** Marca lista la anotación guardada. */
  onReady?: (annotationId: string) => Promise<JournalOutcome>;
  /** Cierra la edición (al guardar o cancelar). */
  onDone?: () => void;
}

/**
 * Formulario de una anotación del diario: agrega una nueva (borrador) o edita una existente.
 * Valida con los esquemas de la API antes de enviar y conserva lo escrito si la API la rechaza.
 */
export function AnnotationForm({
  groupId,
  date,
  areas,
  annotation,
  onCreate,
  onUpdate,
  onReady,
  onDone,
}: AnnotationFormProps) {
  const [values, setValues] = useState<AnnotationFormValues>(
    annotation
      ? valuesFromAnnotation(annotation)
      : emptyAnnotationValues(areas.length === 1 ? (areas[0]?.id ?? '') : ''),
  );
  const [errors, setErrors] = useState<AnnotationErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function change(patch: Partial<AnnotationFormValues>) {
    setValues((previous) => ({ ...previous, ...patch }));
    setErrors((previous) => {
      const next = { ...previous };
      for (const key of Object.keys(patch) as (keyof AnnotationFormValues)[]) {
        delete next[key];
      }
      return next;
    });
  }

  /** Guarda (alta o cambios) y, si `ready`, marca la anotación como lista. */
  async function save(ready: boolean) {
    setFailure(null);
    let outcome: JournalOutcome;
    let id = annotation?.id ?? null;
    if (annotation) {
      const built = buildAnnotationChanges(values, annotation);
      if (!built.ok) {
        setErrors(built.errors);
        return;
      }
      setBusy(true);
      outcome = built.data === null ? { ok: true } : await onUpdate(annotation.id, built.data);
    } else {
      const built = buildCreateAnnotation(values, { groupId, date });
      if (!built.ok) {
        setErrors(built.errors);
        return;
      }
      setBusy(true);
      outcome = await onCreate(built.data);
      id = outcome.ok ? (outcome.createdId ?? null) : null;
    }
    if (outcome.ok && ready && id && onReady) {
      outcome = await onReady(id);
    }
    setBusy(false);
    if (outcome.ok) {
      setErrors({});
      if (annotation) {
        onDone?.();
      } else {
        setValues(emptyAnnotationValues(values.areaId));
      }
      return;
    }
    setErrors(outcome.fields);
    setFailure(outcome.message || null);
  }

  const needsActions = values.eventType === JournalEventType.ToImprove;
  const areaOptions = areas.map((area) => ({ value: area.id, label: area.name }));

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
      aria-label={annotation ? 'Editar anotación' : 'Nueva anotación'}
    >
      <div className={styles.form}>
        <Select
          label="Asignatura"
          required
          placeholder="Selecciona la asignatura"
          options={areaOptions}
          value={values.areaId}
          error={errors.areaId}
          onChange={(event) => change({ areaId: event.target.value })}
        />
        <Select
          label="Tipo de evento"
          required
          placeholder="Selecciona el tipo de evento"
          options={EVENT_OPTIONS}
          value={values.eventType}
          error={errors.eventType}
          onChange={(event) =>
            change({ eventType: event.target.value as AnnotationFormValues['eventType'] })
          }
        />
        <div className={styles.full}>
          <TextInput
            label="Estudiantes implicados"
            placeholder="Ej. Sofía, Matías"
            help="Solo nombres de pila, separados por coma."
            value={values.students}
            error={errors.students}
            onChange={(event) => change({ students: event.target.value })}
          />
        </div>
        <div className={styles.full}>
          <TextArea
            label="Descripción del evento"
            required
            rows={4}
            maxLength={JOURNAL_DESCRIPTION_MAX_LENGTH}
            placeholder="Qué pasó, en qué momento de la clase y cómo respondió el grupo o el estudiante."
            value={values.description}
            error={errors.description}
            onChange={(event) => change({ description: event.target.value })}
          />
        </div>
        <div className={styles.full}>
          <TextArea
            label="Acciones de mejora"
            required={needsActions}
            rows={3}
            maxLength={JOURNAL_ACTIONS_MAX_LENGTH}
            help={needsActions ? 'Obligatorias en un aspecto por mejorar.' : undefined}
            placeholder="Qué se hizo o qué se hará: diálogo, compromiso, comunicación con la familia, ajuste en la clase…"
            value={values.actions}
            error={errors.actions}
            onChange={(event) => change({ actions: event.target.value })}
          />
        </div>
        <div className={styles.full}>
          <TextArea
            label="Reflexión pedagógica (opcional)"
            rows={3}
            maxLength={JOURNAL_REFLECTION_MAX_LENGTH}
            placeholder="¿Qué aprendí de esta situación? ¿Qué cambiaría en mi práctica?"
            value={values.reflection}
            error={errors.reflection}
            onChange={(event) => change({ reflection: event.target.value })}
          />
        </div>
        <p className={`${styles.full} ${styles.hint}`}>
          No registres documentos de identidad, datos de salud, diagnósticos ni fotos de los niños.
        </p>
        {failure ? (
          <div className={styles.full}>
            <Notice tone="error">{failure}</Notice>
          </div>
        ) : null}
        <div className={`${styles.full} ${styles.formActions}`}>
          {annotation ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={onDone}>
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" variant="secondary" size="sm" startIcon="guardar" disabled={busy}>
            {busy ? 'Guardando…' : annotation ? 'Guardar cambios' : 'Guardar borrador'}
          </Button>
          {onReady && annotation?.status !== 'lista' ? (
            <Button size="sm" startIcon="check" disabled={busy} onClick={() => void save(true)}>
              Marcar como lista
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
