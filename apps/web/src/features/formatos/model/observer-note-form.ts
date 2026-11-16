import {
  createObserverNoteSchema,
  normalizeStudentFirstName,
  updateObserverNoteSchema,
  type CreateObserverNoteInput,
  type ObserverNote,
  type ObserverNoteType,
  type UpdateObserverNoteInput,
} from '@gns/shared';

import { mapFieldErrors, sentence, type FieldErrors } from './messages';

/**
 * Estado del formulario de una anotación. Es exactamente la lista de campos que admite la API:
 * no hay lugar para documentos, direcciones, teléfonos, datos de salud, diagnósticos ni fotos.
 */
export interface NoteFormValues {
  gradeId: string;
  /** Solo el nombre de pila. */
  studentFirstName: string;
  date: string;
  type: ObserverNoteType | '';
  description: string;
  studentVersion: string;
  pedagogicalStrategies: string;
  actions: string;
  familyInformed: boolean;
  followUp: string;
}

export type NoteField = keyof NoteFormValues;
export type NoteErrors = Partial<Record<NoteField, string>>;

export const NOTE_FIELDS: readonly NoteField[] = [
  'gradeId',
  'studentFirstName',
  'date',
  'type',
  'description',
  'studentVersion',
  'pedagogicalStrategies',
  'actions',
  'familyInformed',
  'followUp',
];

export function emptyNoteValues(date: string): NoteFormValues {
  return {
    gradeId: '',
    studentFirstName: '',
    date,
    type: '',
    description: '',
    studentVersion: '',
    pedagogicalStrategies: '',
    actions: '',
    familyInformed: false,
    followUp: '',
  };
}

export function valuesFromNote(note: ObserverNote): NoteFormValues {
  return {
    gradeId: note.grade.id,
    studentFirstName: note.studentFirstName,
    date: note.date,
    type: note.type,
    description: note.description,
    studentVersion: note.studentVersion ?? '',
    pedagogicalStrategies: note.pedagogicalStrategies ?? '',
    actions: note.actions ?? '',
    familyInformed: note.familyInformed,
    followUp: note.followUp ?? '',
  };
}

export type NoteBuildResult<T> = { ok: true; data: T } | { ok: false; errors: NoteErrors };

function issuesToErrors(issues: readonly { path: PropertyKey[]; message: string }[]): NoteErrors {
  const errors: NoteErrors = {};
  for (const issue of issues) {
    const root = String(issue.path[0]);
    const field = NOTE_FIELDS.find((name) => name === root);
    if (field) {
      errors[field] ??= sentence(issue.message);
    }
  }
  return errors;
}

/** Alta: valida con el mismo esquema que la API; los opcionales vacíos viajan como `null`. */
export function buildCreateNote(values: NoteFormValues): NoteBuildResult<CreateObserverNoteInput> {
  const parsed = createObserverNoteSchema.safeParse({
    gradeId: values.gradeId,
    studentFirstName: values.studentFirstName,
    date: values.date,
    type: values.type === '' ? undefined : values.type,
    description: values.description,
    studentVersion: values.studentVersion,
    pedagogicalStrategies: values.pedagogicalStrategies,
    actions: values.actions,
    familyInformed: values.familyInformed,
    followUp: values.followUp,
  });
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  const errors = issuesToErrors(parsed.error.issues);
  if (values.gradeId === '') {
    errors.gradeId = 'Elige el grado.';
  }
  if (values.type === '') {
    errors.type = 'Elige el tipo de anotación.';
  }
  return { ok: false, errors };
}

/**
 * Edición: solo viajan los campos que cambiaron (PATCH parcial; el grado no se puede cambiar).
 * `data` es `null` si nada cambió, de modo que no se llama a la API.
 */
export function buildNoteChanges(
  values: NoteFormValues,
  original: ObserverNote,
): NoteBuildResult<UpdateObserverNoteInput | null> {
  const before = valuesFromNote(original);
  const patch: Record<string, unknown> = {};
  if (normalizeStudentFirstName(values.studentFirstName) !== before.studentFirstName) {
    patch.studentFirstName = values.studentFirstName;
  }
  if (values.date !== before.date) patch.date = values.date;
  if (values.type !== before.type) patch.type = values.type === '' ? undefined : values.type;
  if (values.description.trim() !== before.description) patch.description = values.description;
  if (values.studentVersion.trim() !== before.studentVersion) {
    patch.studentVersion = values.studentVersion;
  }
  if (values.pedagogicalStrategies.trim() !== before.pedagogicalStrategies) {
    patch.pedagogicalStrategies = values.pedagogicalStrategies;
  }
  if (values.actions.trim() !== before.actions) patch.actions = values.actions;
  if (values.familyInformed !== before.familyInformed) {
    patch.familyInformed = values.familyInformed;
  }
  if (values.followUp.trim() !== before.followUp) patch.followUp = values.followUp;

  const errors: NoteErrors = {};
  if (values.type === '') {
    errors.type = 'Elige el tipo de anotación.';
  }
  if (Object.keys(patch).length === 0) {
    return Object.keys(errors).length === 0 ? { ok: true, data: null } : { ok: false, errors };
  }
  const parsed = updateObserverNoteSchema.safeParse(patch);
  if (!parsed.success) {
    Object.assign(errors, issuesToErrors(parsed.error.issues));
  }
  if (parsed.success && Object.keys(errors).length === 0) {
    return { ok: true, data: parsed.data };
  }
  return { ok: false, errors };
}

/** Errores 400 de la API por campo del formulario; el resto se devuelve para el aviso general. */
export function mapNoteApiErrors(
  errors: readonly { field: string; reason: string }[] | undefined,
): FieldErrors<NoteField> {
  return mapFieldErrors(errors, NOTE_FIELDS);
}
