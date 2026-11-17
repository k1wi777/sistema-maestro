import {
  JOURNAL_ACTIONS_REQUIRED_REASON,
  createAnnotationSchema,
  journalEntryNeedsActions,
  splitStudents,
  updateAnnotationSchema,
  type CreateAnnotationInput,
  type JournalAnnotation,
  type JournalEventType,
  type UpdateAnnotationInput,
} from '@gns/shared';

import { mapFieldErrors, sentence, type FieldErrors } from './messages';

/** Estado del formulario de una anotación: todo en texto, como lo escribe el docente. */
export interface AnnotationFormValues {
  areaId: string;
  eventType: JournalEventType | '';
  /** Nombres de pila separados por coma o punto y coma. */
  students: string;
  description: string;
  actions: string;
  reflection: string;
}

export type AnnotationField = keyof AnnotationFormValues;
export type AnnotationErrors = Partial<Record<AnnotationField, string>>;

export const ANNOTATION_FIELDS: readonly AnnotationField[] = [
  'areaId',
  'eventType',
  'students',
  'description',
  'actions',
  'reflection',
];

export function emptyAnnotationValues(areaId = ''): AnnotationFormValues {
  return { areaId, eventType: '', students: '', description: '', actions: '', reflection: '' };
}

export function valuesFromAnnotation(annotation: JournalAnnotation): AnnotationFormValues {
  return {
    areaId: annotation.area.id,
    eventType: annotation.eventType,
    students: annotation.students.join(', '),
    description: annotation.description,
    actions: annotation.actions ?? '',
    reflection: annotation.reflection ?? '',
  };
}

/** `students` se separa por coma o punto y coma (misma función que usa la API para guardarlos). */
export function parseStudents(text: string): string[] {
  return splitStudents(text.trim() === '' ? null : text);
}

function issuesToErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): AnnotationErrors {
  const errors: AnnotationErrors = {};
  for (const issue of issues) {
    const root = String(issue.path[0]);
    const field = ANNOTATION_FIELDS.find((name) => name === root);
    if (field) {
      errors[field] ??= sentence(issue.message);
    }
  }
  return errors;
}

export type BuildResult<T> = { ok: true; data: T } | { ok: false; errors: AnnotationErrors };

/** Alta: valida con el mismo esquema que la API (incluida la regla de «Aspecto por mejorar»). */
export function buildCreateAnnotation(
  values: AnnotationFormValues,
  context: { groupId: string; date: string },
): BuildResult<CreateAnnotationInput> {
  const parsed = createAnnotationSchema.safeParse({
    ...context,
    areaId: values.areaId === '' ? undefined : values.areaId,
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
  if (values.areaId === '') {
    errors.areaId = 'Elige la asignatura.';
  }
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
 * La regla de «Aspecto por mejorar» se revisa sobre la anotación resultante, no solo sobre el parche.
 */
export function buildAnnotationChanges(
  values: AnnotationFormValues,
  original: JournalAnnotation,
): BuildResult<UpdateAnnotationInput | null> {
  const before = valuesFromAnnotation(original);
  const patch: Record<string, unknown> = {};
  if (values.areaId !== before.areaId && values.areaId !== '') patch.areaId = values.areaId;
  if (values.eventType !== before.eventType && values.eventType !== '') {
    patch.eventType = values.eventType;
  }
  const students = parseStudents(values.students);
  if (!sameStudents(students, original.students)) patch.students = students;
  if (values.description.trim() !== before.description) patch.description = values.description;
  if (values.actions.trim() !== before.actions) patch.actions = values.actions;
  if (values.reflection.trim() !== before.reflection) patch.reflection = values.reflection;

  const errors: AnnotationErrors = {};
  if (values.areaId === '') {
    errors.areaId = 'Elige la asignatura.';
  }
  if (values.eventType === '') {
    errors.eventType = 'Elige el tipo de evento.';
  }
  if (Object.keys(patch).length === 0) {
    return Object.keys(errors).length === 0 ? { ok: true, data: null } : { ok: false, errors };
  }
  const parsed = updateAnnotationSchema.safeParse(patch);
  if (!parsed.success) {
    Object.assign(errors, issuesToErrors(parsed.error.issues));
    return { ok: false, errors };
  }
  const merged = {
    eventType: parsed.data.eventType ?? original.eventType,
    actions: parsed.data.actions === undefined ? original.actions : parsed.data.actions,
  };
  if (journalEntryNeedsActions(merged.eventType, merged.actions)) {
    errors.actions = sentence(JOURNAL_ACTIONS_REQUIRED_REASON);
  }
  return Object.keys(errors).length === 0 ? { ok: true, data: parsed.data } : { ok: false, errors };
}

/** Errores 400 de la API por campo del formulario; el resto se devuelve para el aviso del bloque. */
export function mapAnnotationApiErrors(
  errors: readonly { field: string; reason: string }[] | undefined,
): FieldErrors<AnnotationField> {
  return mapFieldErrors(errors, ANNOTATION_FIELDS);
}
