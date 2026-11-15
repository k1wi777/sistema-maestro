'use client';

import {
  JOURNAL_ACTIONS_MAX_LENGTH,
  JOURNAL_DESCRIPTION_MAX_LENGTH,
  JOURNAL_LESSON_MAX_LENGTH,
  JOURNAL_REFLECTION_MAX_LENGTH,
  JournalEventType,
  type FieldJournalEntry,
} from '@gns/shared';
import { useState } from 'react';

import { Button, Notice, Select, TextArea, TextInput } from '@/shared/ui';

import type { CreateJournalEntryBody, UpdateJournalEntryBody } from '../api/field-journals';
import type { JournalOutcome } from '../hooks/use-field-journal';
import {
  buildCreateEntry,
  buildEntryChanges,
  emptyEntryValues,
  valuesFromEntry,
  type EntryErrors,
  type EntryFormValues,
} from '../model/journal-entry-form';
import { JOURNAL_EVENT_INFO, JOURNAL_EVENT_ORDER } from '../model/labels';
import styles from './record-screen.module.css';

const EVENT_OPTIONS = JOURNAL_EVENT_ORDER.map((type) => ({
  value: type,
  label: JOURNAL_EVENT_INFO[type].label,
}));

interface JournalEntryFormProps {
  /** Registro que se edita; sin él, el formulario agrega uno nuevo. */
  entry?: FieldJournalEntry;
  /** Fecha propuesta para un registro nuevo (hoy en Colombia). */
  today: string;
  onCreate: (body: CreateJournalEntryBody) => Promise<JournalOutcome>;
  onUpdate: (entryId: string, changes: UpdateJournalEntryBody) => Promise<JournalOutcome>;
  /** Cierra la edición (al guardar o cancelar). */
  onDone?: () => void;
}

/**
 * Formulario de un registro de evento: agrega uno nuevo o edita uno existente. Valida con los
 * esquemas de la API antes de enviar y conserva lo escrito si la API rechaza el registro.
 */
export function JournalEntryForm({
  entry,
  today,
  onCreate,
  onUpdate,
  onDone,
}: JournalEntryFormProps) {
  const [values, setValues] = useState<EntryFormValues>(
    entry ? valuesFromEntry(entry) : emptyEntryValues(today),
  );
  const [errors, setErrors] = useState<EntryErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function change(patch: Partial<EntryFormValues>) {
    setValues((previous) => ({ ...previous, ...patch }));
    setErrors((previous) => {
      const next = { ...previous };
      for (const key of Object.keys(patch) as (keyof EntryFormValues)[]) {
        delete next[key];
      }
      return next;
    });
  }

  async function handleSave() {
    setFailure(null);
    let outcome: JournalOutcome;
    if (entry) {
      const built = buildEntryChanges(values, entry);
      if (!built.ok) {
        setErrors(built.errors);
        return;
      }
      if (built.data === null) {
        onDone?.();
        return;
      }
      setBusy(true);
      outcome = await onUpdate(entry.id, built.data);
    } else {
      const built = buildCreateEntry(values);
      if (!built.ok) {
        setErrors(built.errors);
        return;
      }
      setBusy(true);
      outcome = await onCreate(built.data);
    }
    setBusy(false);
    if (outcome.ok) {
      setErrors({});
      if (entry) {
        onDone?.();
      } else {
        // Los siguientes registros suelen ser del mismo día: se conserva la fecha.
        setValues(emptyEntryValues(values.date));
      }
      return;
    }
    setErrors(outcome.fields);
    setFailure(outcome.message || null);
  }

  const needsActions = values.eventType === JournalEventType.ToImprove;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
      aria-label={entry ? 'Editar registro' : 'Nuevo registro'}
    >
      <div className={styles.form}>
        <TextInput
          label="Fecha"
          type="date"
          required
          value={values.date}
          error={errors.date}
          onChange={(event) => change({ date: event.target.value })}
        />
        <TextInput
          label="Clase o actividad"
          required
          maxLength={JOURNAL_LESSON_MAX_LENGTH}
          placeholder="Ej. English · Sweet Home"
          value={values.lesson}
          error={errors.lesson}
          onChange={(event) => change({ lesson: event.target.value })}
        />
        <Select
          label="Tipo de evento"
          required
          placeholder="Selecciona el tipo de evento"
          options={EVENT_OPTIONS}
          value={values.eventType}
          error={errors.eventType}
          onChange={(event) => change({ eventType: event.target.value as JournalEventType | '' })}
        />
        <TextInput
          label="Estudiantes implicados"
          placeholder="Ej. Sofía, Matías"
          help="Solo nombres de pila, separados por coma."
          value={values.students}
          error={errors.students}
          onChange={(event) => change({ students: event.target.value })}
        />
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
        {failure ? (
          <div className={styles.full}>
            <Notice tone="error">{failure}</Notice>
          </div>
        ) : null}
        <div className={`${styles.full} ${styles.formActions}`}>
          {entry ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={onDone}>
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" size="sm" startIcon={entry ? 'guardar' : 'mas'} disabled={busy}>
            {busy ? 'Guardando…' : entry ? 'Guardar cambios' : 'Agregar al diario'}
          </Button>
        </div>
      </div>
    </form>
  );
}
