'use client';

import {
  CuriocityStage,
  LESSON_PLAN_CORNER_MAX_LENGTH,
  LESSON_PLAN_TEXT_MAX_LENGTH,
  LESSON_PLAN_TOPIC_MAX_LENGTH,
  type LessonPlan,
  type LessonPlanAdjustableField,
} from '@gns/shared';
import { useState } from 'react';

import { Button, Select, TextArea, TextInput } from '@/shared/ui';

import { effectiveValue, type PlanAdjustments } from '../model/adjustments';
import type { PlanBlock } from '../model/plan-blocks';
import styles from './review-block.module.css';

const FIELD_LABELS: Partial<Record<LessonPlanAdjustableField, string>> = {
  dateFrom: 'Fecha de inicio',
  dateTo: 'Fecha final',
};

const STAGE_OPTIONS = Object.values(CuriocityStage).map((stage) => ({
  value: stage,
  label: stage,
}));

interface AdjustmentFormProps {
  block: PlanBlock;
  plan: LessonPlan;
  adjustments: PlanAdjustments;
  /** Valida y deja el ajuste pendiente; devuelve el motivo si no es válido. */
  onSave: (values: PlanAdjustments) => string | null;
  onCancel: () => void;
}

/** Edición inline de un bloque: con el valor vigente a la vista y la validación de `@gns/shared`. */
export function AdjustmentForm({
  block,
  plan,
  adjustments,
  onSave,
  onCancel,
}: AdjustmentFormProps) {
  const [values, setValues] = useState<PlanAdjustments>(() =>
    Object.fromEntries(
      block.fields.map((field) => [field, effectiveValue(plan, adjustments, field)]),
    ),
  );
  const [error, setError] = useState<string | null>(null);

  function change(field: LessonPlanAdjustableField, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setError(null);
  }

  return (
    <form
      className={styles.form}
      aria-label={`Ajustar: ${block.label}`}
      onSubmit={(event) => {
        event.preventDefault();
        setError(onSave(values));
      }}
    >
      <div className={styles.fields}>
        {block.fields.map((field, index) => {
          const label = FIELD_LABELS[field] ?? block.label;
          const fieldError = index === 0 ? (error ?? undefined) : undefined;
          const value = values[field] ?? '';
          if (field === 'dateFrom' || field === 'dateTo') {
            return (
              <TextInput
                key={field}
                type="date"
                label={label}
                value={value}
                error={fieldError}
                onChange={(event) => change(field, event.target.value)}
              />
            );
          }
          if (field === 'curiocityStage') {
            return (
              <Select
                key={field}
                label={label}
                placeholder="Sin etapa"
                options={STAGE_OPTIONS}
                value={value}
                error={fieldError}
                onChange={(event) => change(field, event.target.value)}
              />
            );
          }
          if (field === 'topic' || field === 'learningCorner') {
            return (
              <TextInput
                key={field}
                label={label}
                maxLength={
                  field === 'topic' ? LESSON_PLAN_TOPIC_MAX_LENGTH : LESSON_PLAN_CORNER_MAX_LENGTH
                }
                value={value}
                error={fieldError}
                onChange={(event) => change(field, event.target.value)}
              />
            );
          }
          return (
            <TextArea
              key={field}
              label={label}
              rows={4}
              maxLength={LESSON_PLAN_TEXT_MAX_LENGTH}
              value={value}
              error={fieldError}
              onChange={(event) => change(field, event.target.value)}
            />
          );
        })}
      </div>
      <p className={styles.help}>El docente verá «Coordinación ajustó» en este bloque.</p>
      <div className={styles.formActions}>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" startIcon="guardar">
          Guardar ajuste
        </Button>
      </div>
    </form>
  );
}
