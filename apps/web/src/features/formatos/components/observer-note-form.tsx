'use client';

import {
  OBSERVER_ACTIONS_MAX_LENGTH,
  OBSERVER_DESCRIPTION_MAX_LENGTH,
  OBSERVER_LONG_TEXT_MAX_LENGTH,
  OBSERVER_STRATEGIES_MAX_LENGTH,
  STUDENT_FIRST_NAME_MAX_LENGTH,
  type ObserverNote,
  type ObserverNoteType,
} from '@gns/shared';

import { formatDayWithYear } from '@/shared/format/dates';
import { Checkbox, Notice, Select, TextArea, TextInput, type SelectOption } from '@/shared/ui';

import { OBSERVER_TYPE_INFO, OBSERVER_TYPE_ORDER, requiresConvivenciaRoute } from '../model/labels';
import type { NoteErrors, NoteFormValues } from '../model/observer-note-form';
import styles from './record-screen.module.css';

const TYPE_OPTIONS: SelectOption[] = OBSERVER_TYPE_ORDER.map((type) => ({
  value: type,
  label: OBSERVER_TYPE_INFO[type].label,
}));

/** Avisos fijos del formulario: confidencialidad y privacidad de menores (R17, R18). */
export function ObserverNotices({ type }: { type: ObserverNoteType | '' }) {
  return (
    <>
      <Notice tone="info" title="Anotación confidencial">
        Solo la ven su autor y coordinación. Usa solo el nombre de pila del estudiante: no registres
        documentos de identidad, direcciones, teléfonos, datos de salud, diagnósticos ni fotos.
      </Notice>
      {requiresConvivenciaRoute(type) ? (
        <Notice tone="warning" title="Situación de convivencia Tipo II o III">
          Sigue la ruta de atención del Manual de Convivencia (Ley 1620 de 2013) e informa de
          inmediato a coordinación.
        </Notice>
      ) : null}
    </>
  );
}

interface ObserverNoteFormProps {
  values: NoteFormValues;
  errors: NoteErrors;
  gradeOptions: SelectOption[];
  /** En una anotación existente el grado no se puede cambiar (la API no lo permite). */
  gradeLocked: boolean;
  onChange: (patch: Partial<NoteFormValues>) => void;
}

/** Los campos de una anotación, en el orden del tablero. Nada más: no hay campos para otros datos del estudiante. */
export function ObserverNoteFields({
  values,
  errors,
  gradeOptions,
  gradeLocked,
  onChange,
}: ObserverNoteFormProps) {
  return (
    <div className={styles.form}>
      <Select
        label="Grado"
        required
        placeholder="Selecciona el grado"
        options={gradeOptions}
        value={values.gradeId}
        error={errors.gradeId}
        disabled={gradeLocked}
        help={gradeLocked ? 'El grado no se puede cambiar.' : undefined}
        onChange={(event) => onChange({ gradeId: event.target.value })}
      />
      <TextInput
        label="Estudiante (nombre de pila)"
        required
        maxLength={STUDENT_FIRST_NAME_MAX_LENGTH}
        placeholder="Ej. Sofía"
        autoComplete="off"
        value={values.studentFirstName}
        error={errors.studentFirstName}
        onChange={(event) => onChange({ studentFirstName: event.target.value })}
      />
      <TextInput
        label="Fecha"
        type="date"
        required
        value={values.date}
        error={errors.date}
        onChange={(event) => onChange({ date: event.target.value })}
      />
      <Select
        label="Tipo de anotación"
        required
        placeholder="Selecciona el tipo"
        options={TYPE_OPTIONS}
        value={values.type}
        error={errors.type}
        onChange={(event) => onChange({ type: event.target.value as ObserverNoteType | '' })}
      />
      <div className={styles.full}>
        <TextArea
          label="Comportamiento específico"
          required
          rows={4}
          maxLength={OBSERVER_DESCRIPTION_MAX_LENGTH}
          placeholder="Qué hizo o dijo el estudiante, cuándo y en qué contexto. Describe hechos observables, sin juicios."
          value={values.description}
          error={errors.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </div>
      <div className={styles.full}>
        <TextArea
          label="Descargos o versión del estudiante (opcional)"
          rows={3}
          maxLength={OBSERVER_LONG_TEXT_MAX_LENGTH}
          value={values.studentVersion}
          error={errors.studentVersion}
          onChange={(event) => onChange({ studentVersion: event.target.value })}
        />
      </div>
      <div className={styles.full}>
        <TextArea
          label="Estrategias pedagógicas (opcional)"
          rows={3}
          maxLength={OBSERVER_STRATEGIES_MAX_LENGTH}
          placeholder="Diálogo, acuerdo en el aula, cambio de puesto, trabajo en pareja, remisión a orientación…"
          value={values.pedagogicalStrategies}
          error={errors.pedagogicalStrategies}
          onChange={(event) => onChange({ pedagogicalStrategies: event.target.value })}
        />
      </div>
      <div className={styles.full}>
        <TextArea
          label="Resultados y compromisos"
          rows={3}
          maxLength={OBSERVER_ACTIONS_MAX_LENGTH}
          placeholder="Qué se logró y a qué se comprometen el estudiante, la familia o el docente."
          value={values.actions}
          error={errors.actions}
          onChange={(event) => onChange({ actions: event.target.value })}
        />
      </div>
      <div className={styles.full}>
        <Checkbox
          label="Se informó a la familia"
          checked={values.familyInformed}
          error={errors.familyInformed}
          onChange={(event) => onChange({ familyInformed: event.target.checked })}
        />
      </div>
      <div className={styles.full}>
        <TextArea
          label="Seguimiento (opcional)"
          rows={3}
          maxLength={OBSERVER_LONG_TEXT_MAX_LENGTH}
          placeholder="Cómo evolucionó la situación después de las estrategias."
          value={values.followUp}
          error={errors.followUp}
          onChange={(event) => onChange({ followUp: event.target.value })}
        />
      </div>
    </div>
  );
}

function Fact({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: string | null;
}) {
  return (
    <div className={wide ? styles.full : undefined}>
      <dt>{label}</dt>
      <dd>{children?.trim() ? children : 'Sin información'}</dd>
    </div>
  );
}

/** La misma anotación como texto, para los estados en que no se puede editar. */
export function ObserverNoteReadOnly({ note }: { note: ObserverNote }) {
  return (
    <dl className={styles.facts}>
      <Fact label="Grado">{note.grade.name}</Fact>
      <Fact label="Estudiante (nombre de pila)">{note.studentFirstName}</Fact>
      <Fact label="Fecha">{formatDayWithYear(note.date)}</Fact>
      <Fact label="Tipo de anotación">{OBSERVER_TYPE_INFO[note.type].label}</Fact>
      <Fact label="Comportamiento específico" wide>
        {note.description}
      </Fact>
      <Fact label="Descargos o versión del estudiante" wide>
        {note.studentVersion}
      </Fact>
      <Fact label="Estrategias pedagógicas" wide>
        {note.pedagogicalStrategies}
      </Fact>
      <Fact label="Resultados y compromisos" wide>
        {note.actions}
      </Fact>
      <Fact label="Se informó a la familia">{note.familyInformed ? 'Sí' : 'No'}</Fact>
      <Fact label="Seguimiento" wide>
        {note.followUp}
      </Fact>
    </dl>
  );
}
