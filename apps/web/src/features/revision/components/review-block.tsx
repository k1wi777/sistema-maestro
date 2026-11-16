'use client';

import type { LessonPlan } from '@gns/shared';
import { useState } from 'react';

import { formatDateRange, formatDateTime } from '@/shared/format/dates';
import { Button, Notice, Observation, StatusBadge, TextArea } from '@/shared/ui';

import type { PlanReview } from '../hooks/use-plan-review';
import { effectiveValue, formValueOf, isAdjusted } from '../model/adjustments';
import type { PlanBlock } from '../model/plan-blocks';
import { AdjustmentForm } from './adjustment-form';
import styles from './review-block.module.css';

export const blockAnchor = (key: string): string => `bloque-${key}`;

interface ReviewBlockProps {
  block: PlanBlock;
  plan: LessonPlan;
  review: PlanReview;
}

/** Texto que se pinta de un bloque a partir de los valores de sus campos. */
function describe(block: PlanBlock, read: (field: PlanBlock['fields'][number]) => string): string {
  if (block.key === 'dates') {
    return formatDateRange(read('dateFrom') || null, read('dateTo') || null) ?? 'Sin fechas';
  }
  const value = block.fields.map(read).find((entry) => entry.trim() !== '');
  return value ?? 'Sin contenido';
}

/**
 * Un bloque de la planeación en solo lectura, con «Ajustar» y «Observar» mientras coordinación puede
 * decidir, y sus marcas: «Coordinación ajustó», «Ajuste sin enviar», «Cambió desde tu ajuste» y la
 * observación previa. Las marcas llevan texto, no solo color.
 */
export function ReviewBlock({ block, plan, review }: ReviewBlockProps) {
  const [observing, setObserving] = useState(false);
  const { state, canDecide, resubmission, adjustedDates } = review;

  const pending = block.fields.some((field) => isAdjusted(plan, state.adjustments, field));
  const current = describe(block, (field) => effectiveValue(plan, state.adjustments, field));
  const original = describe(block, (field) => formValueOf(plan, field));
  const adjustedAt = adjustedDates[block.key];
  const changed = resubmission?.changedBlocks.includes(block.key) ?? false;
  const previousObservation = resubmission?.observations[block.key];
  const observation = state.observations[block.key] ?? '';
  const editing = state.editing === block.key;
  const error = review.blockErrors[block.key];

  return (
    <div id={blockAnchor(block.key)} tabIndex={-1} className={styles.block}>
      <div className={styles.head}>
        <h3 className={styles.label}>{block.label}</h3>
        <div className={styles.marks}>
          {adjustedAt ? (
            <StatusBadge tone="info">{`Coordinación ajustó · ${formatDateTime(adjustedAt)}`}</StatusBadge>
          ) : null}
          {pending ? <StatusBadge tone="warning">Ajuste sin enviar</StatusBadge> : null}
          {changed ? <StatusBadge tone="success">Cambió desde tu ajuste</StatusBadge> : null}
        </div>
        {canDecide && !editing ? (
          <div className={styles.actions}>
            <Button
              variant="outline"
              size="sm"
              startIcon="lapiz"
              onClick={() => review.edit(block.key)}
            >
              Ajustar
              <span className="sr-only">{`: ${block.label}`}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              startIcon="comentario"
              aria-expanded={observing}
              onClick={() => setObserving((open) => !open)}
            >
              Observar
              <span className="sr-only">{`: ${block.label}`}</span>
            </Button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <AdjustmentForm
          block={block}
          plan={plan}
          adjustments={state.adjustments}
          onSave={(values) => review.saveAdjustment(block, values)}
          onCancel={() => review.edit(null)}
        />
      ) : (
        <>
          <p className={styles.value}>{current}</p>
          {pending ? (
            <div className={styles.previous}>
              <span className={styles.previousLabel}>Texto anterior</span>
              <p className={styles.previousValue}>{original}</p>
              {canDecide ? (
                <Button variant="outline" size="sm" onClick={() => review.removeAdjustment(block)}>
                  Quitar ajuste
                  <span className="sr-only">{`: ${block.label}`}</span>
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {previousObservation ? (
        <Observation
          title="Tu observación anterior"
          date={resubmission ? formatDateTime(resubmission.returnedAt) : undefined}
        >
          <p className={styles.noteText}>{previousObservation}</p>
        </Observation>
      ) : null}

      {canDecide && observing ? (
        <div className={styles.observe}>
          <TextArea
            label={`Tu observación: ${block.label}`}
            rows={3}
            value={observation}
            help="Se envía al docente junto con la devolución, dentro de un solo comentario."
            onChange={(event) => review.setObservation(block.key, event.target.value)}
          />
          <div className={styles.formActions}>
            {observation ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  review.setObservation(block.key, '');
                  setObserving(false);
                }}
              >
                Quitar observación
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setObserving(false)}>
              Listo
            </Button>
          </div>
        </div>
      ) : observation.trim() ? (
        <Observation title="Tu observación">
          <p className={styles.noteText}>{observation}</p>
          {canDecide ? (
            <Button variant="outline" size="sm" onClick={() => setObserving(true)}>
              Editar observación
              <span className="sr-only">{`: ${block.label}`}</span>
            </Button>
          ) : null}
        </Observation>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
