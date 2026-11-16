import {
  validateLessonPlanForSubmit,
  type ApiFieldError,
  type LessonPlanAdjustableField,
} from '@gns/shared';

import { formatDateRange } from '@/shared/format/dates';
import type { StepSummaryItem } from '@/shared/ui';

import type { FormValues } from './form-state';
import { ADJUSTABLE_FIELD_LABELS, MOMENTS, STEPS, type StepId } from './steps';

export interface SummaryContext {
  gradeName: string;
  /** Áreas de la planeación unidas por coma (ver `lessonPlanAreasLabel`). */
  areaNames: string;
  periodNumber: number;
  linkCount: number;
  adjusted: ReadonlySet<LessonPlanAdjustableField>;
}

export interface ReviewSummary {
  items: StepSummaryItem[];
  /** Campos que impiden enviar (los mismos que valida la API). */
  blocking: ApiFieldError[];
  /** Por qué no se puede enviar, o `null` si se puede. */
  blockedReason: string | null;
}

const filled = (value: string): boolean => value.trim() !== '';

function excerpt(text: string, max = 110): string {
  const flat = text.trim().replace(/\s+/g, ' ');
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

function adjustedNote(step: StepId, adjusted: ReadonlySet<LessonPlanAdjustableField>): string {
  const definition = STEPS.find((candidate) => candidate.id === step);
  const labels = (definition?.adjustableFields ?? [])
    .filter((field) => adjusted.has(field))
    .map((field) => ADJUSTABLE_FIELD_LABELS[field]);
  return labels.length > 0 ? ` Coordinación ajustó: ${labels.join(', ')}.` : '';
}

/**
 * Resumen del último paso: un ítem por paso de contenido con lo que falta o un resumen corto.
 * Bloquean el envío solo los campos que valida la API (`validateLessonPlanForSubmit`, fuente
 * única); el resto de lo vacío se señala pero no impide enviar.
 */
export function buildReviewSummary(values: FormValues, context: SummaryContext): ReviewSummary {
  const blocking = validateLessonPlanForSubmit({
    expectedPerformance: values.expectedPerformance,
    developmentMoment: values.developmentMoment,
  });
  const note = (step: StepId) => adjustedNote(step, context.adjusted);

  const missingGeneral = [
    !filled(values.dateFrom) || !filled(values.dateTo) ? 'las fechas' : null,
    !filled(values.topic) ? 'el tema' : null,
  ].filter((part): part is string => part !== null);
  const general = [
    context.gradeName,
    context.areaNames,
    `Periodo ${context.periodNumber}`,
    formatDateRange(values.dateFrom || null, values.dateTo || null),
  ]
    .filter(Boolean)
    .join(' · ');

  const missingMoments = MOMENTS.filter((moment) => !filled(values[moment.field]));
  const developmentMissing = !filled(values.developmentMoment);
  const missingResources = [
    !filled(values.resources) ? 'recursos y materiales' : null,
    !filled(values.reasonableAdjustments) ? 'D.U.A' : null,
  ].filter((part): part is string => part !== null);

  const items: StepSummaryItem[] = [
    {
      id: 'datos',
      title: 'Datos generales',
      complete: missingGeneral.length === 0,
      detail:
        missingGeneral.length === 0
          ? `${general}.${note('datos')}`
          : `${general}. Falta: ${missingGeneral.join(' y ')}.${note('datos')}`,
    },
    {
      id: 'desempeno',
      title: 'Desempeño esperado',
      complete: filled(values.expectedPerformance),
      detail: filled(values.expectedPerformance)
        ? `${excerpt(values.expectedPerformance)}${note('desempeno')}`
        : 'Falta el desempeño esperado (obligatorio para enviar).',
    },
    {
      id: 'momentos',
      title: 'Momentos de la clase',
      complete: missingMoments.length === 0,
      detail:
        missingMoments.length === 0
          ? `Los cuatro momentos están escritos.${note('momentos')}`
          : `Falta: ${missingMoments.map((moment) => `Momento ${moment.number} · ${moment.short}`).join(', ')}${
              developmentMissing ? ' (el Momento 2 es obligatorio para enviar)' : ''
            }.${note('momentos')}`,
    },
    {
      id: 'recursos',
      title: 'Recursos y D.U.A',
      complete: missingResources.length === 0,
      detail:
        missingResources.length === 0
          ? `Recursos y D.U.A escritos.${note('recursos')}`
          : `Falta: ${missingResources.join(' y ')} (opcional).${note('recursos')}`,
    },
    {
      id: 'digitales',
      title: 'Recursos digitales',
      complete: context.linkCount > 0,
      detail:
        context.linkCount > 0
          ? `${context.linkCount} ${context.linkCount === 1 ? 'recurso enlazado' : 'recursos enlazados'}.`
          : 'Sin enlaces (opcional).',
    },
  ];

  const blockedReason =
    blocking.length === 0
      ? null
      : `Completa ${blocking
          .map((error) =>
            error.field === 'expectedPerformance'
              ? 'el desempeño esperado'
              : 'el Momento 2 · Desarrollo',
          )
          .join(' y ')} para poder enviarla.`;

  return { items, blocking, blockedReason };
}
