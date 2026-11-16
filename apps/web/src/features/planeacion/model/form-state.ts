import {
  LESSON_PLAN_CORNER_MAX_LENGTH,
  LESSON_PLAN_TEXT_MAX_LENGTH,
  LESSON_PLAN_TOPIC_MAX_LENGTH,
  updateLessonPlanSchema,
  type LessonPlan,
} from '@gns/shared';

import type { UpdateLessonPlanBody } from '../api/lesson-plans';

/**
 * Campos que el docente edita en el asistente; todos viajan como texto (`''` = vacío).
 * `areaIds` es la lista de áreas como ids ordenados y unidos por coma (ver `areaIdsToValue`),
 * de modo que compararla como texto equivale a compararla como conjunto.
 */
export const FORM_FIELDS = [
  'periodId',
  'areaIds',
  'dateFrom',
  'dateTo',
  'topic',
  'expectedPerformance',
  'learningCorner',
  'curiocityStage',
  'explorationMoment',
  'developmentMoment',
  'socializationMoment',
  'closingMoment',
  'resources',
  'reasonableAdjustments',
] as const;
export type FormField = (typeof FORM_FIELDS)[number];
export type FormValues = Record<FormField, string>;
export type FormErrors = Partial<Record<FormField, string>>;

/** Máximos de cada campo de texto, los mismos del esquema compartido. */
export const FIELD_MAX_LENGTH = {
  topic: LESSON_PLAN_TOPIC_MAX_LENGTH,
  learningCorner: LESSON_PLAN_CORNER_MAX_LENGTH,
  text: LESSON_PLAN_TEXT_MAX_LENGTH,
} as const;

/** Lista de ids de área como valor de formulario: ordenada, para que el orden no cuente. */
export function areaIdsToValue(areaIds: readonly string[]): string {
  return [...areaIds].sort().join(',');
}

export function valueToAreaIds(value: string): string[] {
  return value === '' ? [] : value.split(',');
}

export function toFormValues(plan: LessonPlan): FormValues {
  return {
    periodId: plan.period.id,
    areaIds: areaIdsToValue(plan.areas.map((area) => area.id)),
    dateFrom: plan.dateFrom ?? '',
    dateTo: plan.dateTo ?? '',
    topic: plan.topic ?? '',
    expectedPerformance: plan.expectedPerformance ?? '',
    learningCorner: plan.learningCorner ?? '',
    curiocityStage: plan.curiocityStage ?? '',
    explorationMoment: plan.explorationMoment ?? '',
    developmentMoment: plan.developmentMoment ?? '',
    socializationMoment: plan.socializationMoment ?? '',
    closingMoment: plan.closingMoment ?? '',
    resources: plan.resources ?? '',
    reasonableAdjustments: plan.reasonableAdjustments ?? '',
  };
}

/** Igual que el esquema de la API: se recorta y vacío equivale a «sin valor». */
export function normalizeValue(value: string): string {
  return value.trim();
}

/** Campos cuyo valor normalizado difiere entre lo guardado y el borrador. */
export function dirtyFields(saved: FormValues, draft: FormValues): FormField[] {
  return FORM_FIELDS.filter(
    (field) => normalizeValue(saved[field]) !== normalizeValue(draft[field]),
  );
}

/** `dateTo` anterior a `dateFrom`, con el mensaje para el campo de la fecha final. */
export function dateRangeError(values: Pick<FormValues, 'dateFrom' | 'dateTo'>): string | null {
  const { dateFrom, dateTo } = values;
  return dateFrom && dateTo && dateTo < dateFrom
    ? 'La fecha final no puede ser anterior a la inicial.'
    : null;
}

export type PatchResult =
  | { kind: 'unchanged' }
  | { kind: 'invalid'; errors: FormErrors }
  | { kind: 'patch'; body: UpdateLessonPlanBody; fields: FormField[] };

/** Campo del formulario al que pertenece una ruta de error: `areaIds.1` es del campo `areaIds`. */
function formFieldOf(path: unknown): FormField | null {
  const name = typeof path === 'string' ? path.split('.')[0] : path;
  return typeof name === 'string' && (FORM_FIELDS as readonly string[]).includes(name)
    ? (name as FormField)
    : null;
}

/**
 * Cuerpo del `PATCH` con solo los campos modificados, validado con el esquema compartido antes de
 * enviarlo. Sin cambios no hay cuerpo (y por tanto ninguna petición).
 */
export function buildPatch(saved: FormValues, draft: FormValues): PatchResult {
  const fields = dirtyFields(saved, draft);
  if (fields.length === 0) {
    return { kind: 'unchanged' };
  }
  const errors: FormErrors = {};
  const rangeError = dateRangeError(draft);
  if (rangeError && fields.some((field) => field === 'dateFrom' || field === 'dateTo')) {
    errors.dateTo = rangeError;
  }

  const raw: Record<string, string | string[] | null> = {};
  for (const field of fields) {
    const value = normalizeValue(draft[field]);
    if (field === 'areaIds') {
      raw[field] = valueToAreaIds(value);
    } else {
      raw[field] = value === '' && field !== 'periodId' ? null : value;
    }
  }
  const parsed = updateLessonPlanSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = formFieldOf(issue.path[0]);
      if (field && !errors[field]) {
        errors[field] = issue.message;
      }
    }
  }
  if (Object.keys(errors).length > 0 || !parsed.success) {
    return { kind: 'invalid', errors };
  }
  return { kind: 'patch', body: parsed.data, fields };
}

/**
 * Traslada a los campos del formulario los errores `{ field, reason }` de un 400 de la API; los que
 * no corresponden a un campo editable se devuelven aparte para mostrarlos en el aviso general.
 */
export function mapApiErrors(errors: readonly { field: string; reason: string }[] | undefined): {
  fields: FormErrors;
  other: string[];
} {
  const fields: FormErrors = {};
  const other: string[] = [];
  for (const { field, reason } of errors ?? []) {
    const formField = formFieldOf(field);
    if (formField) {
      fields[formField] ??= reason;
    } else {
      other.push(reason);
    }
  }
  return { fields, other };
}
