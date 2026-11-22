'use client';

import {
  JOURNAL_DESCRIPTION_MAX_LENGTH,
  type JournalAnnotation,
  type JournalViewer,
} from '@gns/shared';
import { useState } from 'react';

import { Button, Notice, Select, TextArea } from '@/shared/ui';

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
import { JOURNAL_FORMAT_NOTES } from '../model/labels';
import styles from './record-screen.module.css';

const DESCRIPTION_HELP = `Notas del formato: 1. ${JOURNAL_FORMAT_NOTES[0]} 2. ${JOURNAL_FORMAT_NOTES[1]}`;

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
        <div className={styles.full}>
          <Select
            label="Clase (asignatura)"
            required
            placeholder="Selecciona la clase"
            options={areaOptions}
            value={values.areaId}
            error={errors.areaId}
            onChange={(event) => change({ areaId: event.target.value })}
          />
        </div>
        <div className={styles.full}>
          <TextArea
            label="Descripción de eventos"
            required
            rows={5}
            maxLength={JOURNAL_DESCRIPTION_MAX_LENGTH}
            help={DESCRIPTION_HELP}
            placeholder="Qué pasó, en qué momento de la clase y quién estuvo implicado (solo nombre de pila)."
            value={values.description}
            error={errors.description}
            onChange={(event) => change({ description: event.target.value })}
          />
        </div>
        <p className={`${styles.full} ${styles.hint}`}>
          Usa solo el nombre de pila del estudiante. No registres documentos de identidad, datos de
          salud, diagnósticos ni fotos de los niños.
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
