import {
  lessonPlanChangesSchema,
  type LessonPlan,
  type LessonPlanAdjustableField,
} from '@gns/shared';

import type { PlanBlock } from './plan-blocks';
import { sentence } from './messages';

/** Valor de formulario (texto) de cada campo que coordinación ajustó y aún no envió. */
export type PlanAdjustments = Partial<Record<LessonPlanAdjustableField, string>>;

/** Valor de un campo de la planeación como texto de formulario (vacío si no tiene). */
export function formValueOf(
  plan: Pick<LessonPlan, LessonPlanAdjustableField>,
  field: LessonPlanAdjustableField,
): string {
  return plan[field] ?? '';
}

/** Valor vigente de un campo: el ajuste pendiente si lo hay, o el de la planeación. */
export function effectiveValue(
  plan: Pick<LessonPlan, LessonPlanAdjustableField>,
  adjustments: PlanAdjustments,
  field: LessonPlanAdjustableField,
): string {
  return adjustments[field] ?? formValueOf(plan, field);
}

const clean = (value: string): string => value.trim();

/**
 * Cuerpo `changes` de la decisión: solo los campos cuyo valor ajustado difiere del actual (los
 * vacíos van como `null`, que vacía el campo). Sin diferencias devuelve `null` y la decisión va
 * sin `changes` (la API responde 400 si llega vacío).
 */
export function buildChanges(
  plan: Pick<LessonPlan, LessonPlanAdjustableField>,
  adjustments: PlanAdjustments,
): Record<string, string | null> | null {
  const changes: Record<string, string | null> = {};
  for (const [field, value] of Object.entries(adjustments) as [
    LessonPlanAdjustableField,
    string,
  ][]) {
    const next = clean(value);
    if (next !== clean(formValueOf(plan, field))) {
      changes[field] = next === '' ? null : next;
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

/** El campo tiene un ajuste pendiente que cambia el valor de la planeación. */
export function isAdjusted(
  plan: Pick<LessonPlan, LessonPlanAdjustableField>,
  adjustments: PlanAdjustments,
  field: LessonPlanAdjustableField,
): boolean {
  const value = adjustments[field];
  return value !== undefined && clean(value) !== clean(formValueOf(plan, field));
}

/**
 * Valida el ajuste de un bloque con el esquema de `@gns/shared` (el mismo que usa la API) y la
 * regla de que la fecha final no sea anterior a la de inicio. Devuelve el motivo o `null`.
 */
export function validateAdjustment(
  plan: Pick<LessonPlan, LessonPlanAdjustableField>,
  adjustments: PlanAdjustments,
  block: Pick<PlanBlock, 'fields' | 'label'>,
  values: PlanAdjustments,
): string | null {
  for (const field of block.fields) {
    const raw = clean(values[field] ?? '');
    const parsed = lessonPlanChangesSchema.safeParse({ [field]: raw === '' ? null : raw });
    if (!parsed.success) {
      return sentence(parsed.error.issues[0]?.message ?? '');
    }
  }
  const merged = { ...adjustments, ...values };
  const from = clean(merged.dateFrom ?? formValueOf(plan, 'dateFrom'));
  const to = clean(merged.dateTo ?? formValueOf(plan, 'dateTo'));
  if (block.fields.includes('dateFrom') && from !== '' && to !== '' && to < from) {
    return 'La fecha final no puede ser anterior a la de inicio.';
  }
  return null;
}
