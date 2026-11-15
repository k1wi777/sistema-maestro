import {
  JOURNAL_ACTIONS_REQUIRED_REASON,
  createFieldJournalEntrySchema,
  journalEntryNeedsActions,
  splitStudents,
  updateFieldJournalEntrySchema,
  type CreateFieldJournalEntryInput,
  type FieldJournalEntry,
  type JournalEventType,
  type UpdateFieldJournalEntryInput,
} from '@gns/shared';

import { mapFieldErrors, sentence, type FieldErrors } from './messages';

/** Estado del formulario de un registro de evento: todo en texto, como lo escribe el docente. */
export interface EntryFormValues {
  date: string;
  lesson: string;
  eventType: JournalEventType | '';
  /** Nombres de pila separados por coma o punto y coma. */
  students: string;
  description: string;
  actions: string;
  reflection: string;
}

export type EntryField = keyof EntryFormValues;
export type EntryErrors = Partial<Record<EntryField, string>>;

export const ENTRY_FIELDS: readonly EntryField[] = [
  'date',
  'lesson',
  'eventType',
  'students',
  'description',
  'actions',
  'reflection',
];

export function emptyEntryValues(date: string): EntryFormValues {
  return {
    date,
    lesson: '',
    eventType: '',
    students: '',
    description: '',
    actions: '',
    reflection: '',
  };
}

export function valuesFromEntry(entry: FieldJournalEntry): EntryFormValues {
  return {
    date: entry.date,
    lesson: entry.lesson ?? '',
    eventType: entry.eventType,
    students: entry.students.join(', '),
    description: entry.description,
    actions: entry.actions ?? '',
    reflection: entry.reflection ?? '',
  };
}

/** `students` se separa por coma o punto y coma (misma función que usa la API para guardarlos). */
export function parseStudents(text: string): string[] {
  return splitStudents(text.trim() === '' ? null : text);
}

function issuesToErrors(issues: readonly { path: PropertyKey[]; message: string }[]): EntryErrors {
  const errors: EntryErrors = {};
  for (const issue of issues) {
    const root = String(issue.path[0]);
    const field = ENTRY_FIELDS.find((name) => name === root);
    if (field) {
      errors[field] ??= sentence(issue.message);
    }
  }
  return errors;
}

export type BuildResult<T> = { ok: true; data: T } | { ok: false; errors: EntryErrors };

/** Alta: valida con el mismo esquema que la API (incluida la regla de «Aspecto por mejorar»). */
export function buildCreateEntry(
  values: EntryFormValues,
): BuildResult<CreateFieldJournalEntryInput> {
  const parsed = createFieldJournalEntrySchema.safeParse({
    date: values.date,
    lesson: values.lesson,
    eventType: values.eventType === '' ? undefined : values.eventType,
    students: parseStudents(values.students),
    description: values.description,
    actions: values.actions,
    reflection: values.reflection,
  });
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  const errors = issuesToErrors(parsed.error.issues);
  if (values.eventType === '') {
    errors.eventType = 'Elige el tipo de evento.';
  }
  return { ok: false, errors };
}

function sameStudents(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, index) => name === b[index]);
}

/**
 * Edición: solo viajan los campos que cambiaron (PATCH parcial). `data` es `null` si nada cambió.
 * La regla de «Aspecto por mejorar» se revisa sobre el registro resultante, no solo sobre el parche.
 */
export function buildEntryChanges(
  values: EntryFormValues,
  original: FieldJournalEntry,
): BuildResult<UpdateFieldJournalEntryInput | null> {
  const before = valuesFromEntry(original);
  const patch: Record<string, unknown> = {};
  if (values.date !== before.date) patch.date = values.date;
  if (values.lesson.trim() !== before.lesson) patch.lesson = values.lesson;
  if (values.eventType !== before.eventType) {
    patch.eventType = values.eventType === '' ? undefined : values.eventType;
  }
  const students = parseStudents(values.students);
  if (!sameStudents(students, original.students)) patch.students = students;
  if (values.description.trim() !== before.description) patch.description = values.description;
  if (values.actions.trim() !== before.actions) patch.actions = values.actions;
  if (values.reflection.trim() !== before.reflection) patch.reflection = values.reflection;

  const errors: EntryErrors = {};
  if (values.eventType === '') {
    errors.eventType = 'Elige el tipo de evento.';
  }
  if (Object.keys(patch).length > 0) {
    const parsed = updateFieldJournalEntrySchema.safeParse(patch);
    if (!parsed.success) {
      Object.assign(errors, issuesToErrors(parsed.error.issues));
    } else if (Object.keys(errors).length === 0) {
      const merged = {
        eventType: parsed.data.eventType ?? original.eventType,
        actions: parsed.data.actions === undefined ? original.actions : parsed.data.actions,
      };
      if (journalEntryNeedsActions(merged.eventType, merged.actions)) {
        errors.actions = sentence(JOURNAL_ACTIONS_REQUIRED_REASON);
      } else {
        return { ok: true, data: parsed.data };
      }
    }
  } else if (Object.keys(errors).length === 0) {
    return { ok: true, data: null };
  }
  return { ok: false, errors };
}

/** Errores 400 de la API por campo del formulario; el resto se devuelve para el aviso del bloque. */
export function mapEntryApiErrors(
  errors: readonly { field: string; reason: string }[] | undefined,
): FieldErrors<EntryField> {
  return mapFieldErrors(errors, ENTRY_FIELDS);
}
