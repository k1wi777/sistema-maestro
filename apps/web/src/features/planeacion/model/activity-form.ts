import {
  SharedActivityType,
  createSharedActivitySchema,
  updateSharedActivitySchema,
  type SharedActivity,
} from '@gns/shared';

import type { CreateSharedActivityBody, UpdateSharedActivityBody } from '../api/shared-activities';

/** Campos del formulario de compartir una actividad; todos como texto salvo el tipo. */
export interface ActivityFormValues {
  title: string;
  objective: string;
  activityType: SharedActivityType;
  levelId: string;
  /** Vacío = «Todo el nivel». */
  gradeId: string;
  areaId: string;
  learningCorner: string;
  durationMinutes: string;
  materials: string;
  steps: string;
  link: string;
}

export type ActivityField = keyof ActivityFormValues;
export type ActivityErrors = Partial<Record<ActivityField, string>>;

export const EMPTY_ACTIVITY_FORM: ActivityFormValues = {
  title: '',
  objective: '',
  activityType: SharedActivityType.Activity,
  levelId: '',
  gradeId: '',
  areaId: '',
  learningCorner: '',
  durationMinutes: '',
  materials: '',
  steps: '',
  link: '',
};

const ACTIVITY_FIELDS = Object.keys(EMPTY_ACTIVITY_FORM) as ActivityField[];

export function isActivityField(value: unknown): value is ActivityField {
  return typeof value === 'string' && (ACTIVITY_FIELDS as string[]).includes(value);
}

export function activityToFormValues(activity: SharedActivity): ActivityFormValues {
  return {
    title: activity.title,
    objective: activity.objective ?? '',
    activityType: activity.activityType,
    levelId: activity.level?.id ?? '',
    gradeId: activity.grade?.id ?? '',
    areaId: activity.area?.id ?? '',
    learningCorner: activity.learningCorner ?? '',
    durationMinutes: activity.durationMinutes === null ? '' : String(activity.durationMinutes),
    materials: activity.materials ?? '',
    steps: activity.steps,
    link: activity.link ?? '',
  };
}

const trimmed = (value: string): string => value.trim();

/** Cada campo ya como lo recibe la API; vacío es `null` (menos el título, el paso a paso y el tipo). */
function apiValue(values: ActivityFormValues, field: ActivityField): string | number | null {
  const value = trimmed(values[field]);
  if (field === 'title' || field === 'steps' || field === 'activityType') {
    return value;
  }
  if (field === 'durationMinutes') {
    return value === '' ? null : Number(value);
  }
  return value === '' ? null : value;
}

function collectErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): ActivityErrors {
  const errors: ActivityErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (isActivityField(field) && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

export type ActivityBodyResult<T> =
  { kind: 'body'; body: T } | { kind: 'invalid'; errors: ActivityErrors } | { kind: 'unchanged' };

/**
 * Cuerpo de publicar. Con grado no se envía el nivel (la API lo deriva y rechaza un grado de otro
 * nivel con un 400 en `gradeId`); los campos vacíos opcionales no se envían.
 */
export function buildCreateBody(
  values: ActivityFormValues,
): ActivityBodyResult<CreateSharedActivityBody> {
  const raw: Record<string, unknown> = {
    title: apiValue(values, 'title'),
    steps: apiValue(values, 'steps'),
    activityType: values.activityType,
  };
  for (const field of [
    'objective',
    'materials',
    'link',
    'areaId',
    'learningCorner',
    'durationMinutes',
  ] as const) {
    const value = apiValue(values, field);
    if (value !== null) {
      raw[field] = value;
    }
  }
  if (values.gradeId) {
    raw.gradeId = values.gradeId;
  } else if (values.levelId) {
    raw.levelId = values.levelId;
  }
  if (typeof raw.durationMinutes === 'number' && Number.isNaN(raw.durationMinutes)) {
    return { kind: 'invalid', errors: { durationMinutes: 'Escribe un número de minutos.' } };
  }
  const parsed = createSharedActivitySchema.safeParse(raw);
  return parsed.success
    ? { kind: 'body', body: parsed.data }
    : { kind: 'invalid', errors: collectErrors(parsed.error.issues) };
}

/**
 * Cuerpo de editar con solo los campos modificados; nunca `activityType: null`. Si cambia el grado
 * o el nivel, viajan juntos de forma coherente: con grado solo `gradeId`; sin grado, `gradeId: null`
 * y el nivel.
 */
export function buildUpdateBody(
  original: ActivityFormValues,
  values: ActivityFormValues,
): ActivityBodyResult<UpdateSharedActivityBody> {
  const raw: Record<string, unknown> = {};
  for (const field of [
    'title',
    'steps',
    'objective',
    'materials',
    'link',
    'areaId',
    'learningCorner',
    'durationMinutes',
  ] as const) {
    if (trimmed(original[field]) !== trimmed(values[field])) {
      raw[field] = apiValue(values, field);
    }
  }
  if (original.activityType !== values.activityType) {
    raw.activityType = values.activityType;
  }
  if (original.gradeId !== values.gradeId || original.levelId !== values.levelId) {
    if (values.gradeId) {
      raw.gradeId = values.gradeId;
    } else {
      raw.gradeId = null;
      raw.levelId = values.levelId || null;
    }
  }
  if (Object.keys(raw).length === 0) {
    return { kind: 'unchanged' };
  }
  if (typeof raw.durationMinutes === 'number' && Number.isNaN(raw.durationMinutes)) {
    return { kind: 'invalid', errors: { durationMinutes: 'Escribe un número de minutos.' } };
  }
  const parsed = updateSharedActivitySchema.safeParse(raw);
  return parsed.success
    ? { kind: 'body', body: parsed.data }
    : { kind: 'invalid', errors: collectErrors(parsed.error.issues) };
}
