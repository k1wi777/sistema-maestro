import type { LessonPlanAdjustableField } from '@gns/shared';

import type { FormValues } from './form-state';

export {
  ADJUSTABLE_FIELD_LABELS,
  FIELD_BY_COLUMN,
  MOMENTS,
  type Moment,
  type MomentField,
} from '@/shared/records/lesson-plan-fields';

export type StepId = 'datos' | 'desempeno' | 'momentos' | 'recursos' | 'digitales' | 'revisar';

export interface StepDefinition {
  id: StepId;
  title: string;
  /** Campos cuyo contenido decide si el paso está completo. */
  contentFields: readonly (keyof FormValues)[];
  /** Campos que coordinación puede ajustar en el paso. */
  adjustableFields: readonly LessonPlanAdjustableField[];
}

export const STEPS: readonly StepDefinition[] = [
  {
    id: 'datos',
    title: 'Datos generales',
    contentFields: ['dateFrom', 'dateTo', 'topic'],
    adjustableFields: ['dateFrom', 'dateTo', 'topic'],
  },
  {
    id: 'desempeno',
    title: 'Desempeño esperado',
    contentFields: ['expectedPerformance'],
    adjustableFields: ['expectedPerformance'],
  },
  {
    id: 'momentos',
    title: 'Momentos de la clase',
    contentFields: [
      'explorationMoment',
      'developmentMoment',
      'socializationMoment',
      'closingMoment',
    ],
    // El rincón y la etapa CurioCity no cuentan para completar el paso, pero coordinación los ajusta.
    adjustableFields: [
      'learningCorner',
      'curiocityStage',
      'explorationMoment',
      'developmentMoment',
      'socializationMoment',
      'closingMoment',
    ],
  },
  {
    id: 'recursos',
    title: 'Recursos y ajustes razonables',
    contentFields: ['resources', 'reasonableAdjustments'],
    adjustableFields: ['resources', 'reasonableAdjustments'],
  },
  { id: 'digitales', title: 'Recursos digitales', contentFields: [], adjustableFields: [] },
  { id: 'revisar', title: 'Revisar y enviar', contentFields: [], adjustableFields: [] },
];

/** Pasos que muestran contenido editable (todos menos el resumen final). */
export const CONTENT_STEPS: readonly StepDefinition[] = STEPS.filter(
  (step) => step.id !== 'revisar',
);

export const FIRST_STEP: StepId = 'datos';

export function isStepId(value: string | null | undefined): value is StepId {
  return STEPS.some((step) => step.id === value);
}

export function stepIndex(id: StepId): number {
  return STEPS.findIndex((step) => step.id === id);
}

export function stepById(id: StepId): StepDefinition {
  return STEPS[stepIndex(id)] ?? STEPS[0]!;
}

/** Paso que sigue o precede a `id`; `null` en los extremos. */
export function neighbourStep(id: StepId, offset: 1 | -1): StepDefinition | null {
  return STEPS[stepIndex(id) + offset] ?? null;
}

/** Paso en que está el campo `field` de coordinación. */
export function stepOfAdjustedField(field: LessonPlanAdjustableField): StepId | null {
  return STEPS.find((step) => step.adjustableFields.includes(field))?.id ?? null;
}

export type PlanStepState = 'done' | 'adjusted' | 'empty' | 'pending';

const hasContent = (value: string | undefined): boolean => (value ?? '').trim() !== '';

/**
 * Estado de un paso para el `Stepper`: `adjusted` si coordinación ajustó alguno de sus campos en
 * la última decisión; si no, `done` con todos los campos con contenido, `empty` sin ninguno y
 * `pending` con algunos. «Recursos digitales» es opcional: `done` con al menos un enlace y `empty`
 * sin ninguno. El resumen final no se evalúa aquí.
 */
export function stepState(
  step: StepDefinition,
  values: FormValues,
  adjusted: ReadonlySet<LessonPlanAdjustableField>,
  linkCount: number,
): PlanStepState {
  if (step.adjustableFields.some((field) => adjusted.has(field))) {
    return 'adjusted';
  }
  if (step.id === 'digitales') {
    return linkCount > 0 ? 'done' : 'empty';
  }
  const filled = step.contentFields.filter((field) => hasContent(values[field])).length;
  if (filled === 0) {
    return 'empty';
  }
  return filled === step.contentFields.length ? 'done' : 'pending';
}

/** Paso del editor en que se escribe un campo del formulario (el periodo está en «Datos generales»). */
export function stepOfFormField(field: string): StepId | null {
  if (field === 'periodId') {
    return 'datos';
  }
  const found = STEPS.find(
    (step) =>
      (step.contentFields as readonly string[]).includes(field) ||
      (step.adjustableFields as readonly string[]).includes(field),
  );
  return found?.id ?? null;
}
