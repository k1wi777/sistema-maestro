import {
  createAnnotationSchema,
  updateAnnotationSchema,
  type CreateAnnotationInput,
  type JournalAnnotation,
  type UpdateAnnotationInput,
} from '@gns/shared';

import { mapFieldErrors, sentence, type FieldErrors } from './messages';

/** Estado del formulario de una anotación (F-PA-05): la clase y la descripción de eventos. */
export interface AnnotationFormValues {
  areaId: string;
  description: string;
}

export type AnnotationField = keyof AnnotationFormValues;
export type AnnotationErrors = Partial<Record<AnnotationField, string>>;

export const ANNOTATION_FIELDS: readonly AnnotationField[] = ['areaId', 'description'];

export function emptyAnnotationValues(areaId = ''): AnnotationFormValues {
  return { areaId, description: '' };
}

export function valuesFromAnnotation(annotation: JournalAnnotation): AnnotationFormValues {
  return { areaId: annotation.area.id, description: annotation.description };
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

/** Alta: valida con el mismo esquema que la API. */
export function buildCreateAnnotation(
  values: AnnotationFormValues,
  context: { groupId: string; date: string },
): BuildResult<CreateAnnotationInput> {
  const parsed = createAnnotationSchema.safeParse({
    ...context,
    areaId: values.areaId === '' ? undefined : values.areaId,
    description: values.description,
  });
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  const errors = issuesToErrors(parsed.error.issues);
  if (values.areaId === '') {
    errors.areaId = 'Elige la clase.';
  }
  return { ok: false, errors };
}

/** Edición: solo viajan los campos que cambiaron (PATCH parcial). `data` es `null` si nada cambió. */
export function buildAnnotationChanges(
  values: AnnotationFormValues,
  original: JournalAnnotation,
): BuildResult<UpdateAnnotationInput | null> {
  const before = valuesFromAnnotation(original);
  const patch: Record<string, unknown> = {};
  if (values.areaId !== before.areaId && values.areaId !== '') patch.areaId = values.areaId;
  if (values.description.trim() !== before.description) patch.description = values.description;

  const errors: AnnotationErrors = {};
  if (values.areaId === '') {
    errors.areaId = 'Elige la clase.';
  }
  if (Object.keys(patch).length === 0) {
    return Object.keys(errors).length === 0 ? { ok: true, data: null } : { ok: false, errors };
  }
  const parsed = updateAnnotationSchema.safeParse(patch);
  if (!parsed.success) {
    Object.assign(errors, issuesToErrors(parsed.error.issues));
    return { ok: false, errors };
  }
  return Object.keys(errors).length === 0 ? { ok: true, data: parsed.data } : { ok: false, errors };
}

/** Errores 400 de la API por campo del formulario; el resto se devuelve para el aviso del bloque. */
export function mapAnnotationApiErrors(
  errors: readonly { field: string; reason: string }[] | undefined,
): FieldErrors<AnnotationField> {
  return mapFieldErrors(errors, ANNOTATION_FIELDS);
}
