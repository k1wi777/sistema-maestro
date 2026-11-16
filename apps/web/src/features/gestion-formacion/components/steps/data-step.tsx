'use client';

import { useMemo } from 'react';

import { Card, Select, TextArea, TextInput } from '@/shared/ui';

import { completionSummary } from '../../model/completion-summary';
import { MODULE_FIELD_MAX_LENGTH } from '../../model/module-form';
import styles from './steps.module.css';
import type { StepProps } from './step-types';

interface DataStepProps extends StepProps {
  /** Solo el plan General se divide en partes que se pueden cambiar. */
  isGeneral: boolean;
}

/** Paso «Datos del módulo»: número, título, descripción, parte, umbral y segundos por pregunta. */
export function DataStep({ editor, number, isGeneral }: DataStepProps) {
  const { detail, draft, errors, tree } = editor;
  const threshold = /^\d+$/.test(draft.approvalThreshold.trim())
    ? Number(draft.approvalThreshold.trim())
    : detail.approvalThreshold;
  const summary = useMemo(() => completionSummary(detail, threshold), [detail, threshold]);

  return (
    <Card title="Datos del módulo" step={number}>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>Plan</dt>
          <dd>{tree.plan.name}</dd>
        </div>
      </dl>
      <div className={styles.grid}>
        <TextInput
          label="Número"
          value={draft.number}
          error={errors.number}
          maxLength={MODULE_FIELD_MAX_LENGTH.number}
          autoComplete="off"
          onChange={(event) => editor.setField('number', event.target.value)}
        />
        <TextInput
          label="Título"
          required
          value={draft.title}
          error={errors.title}
          autoComplete="off"
          onChange={(event) => editor.setField('title', event.target.value)}
        />
        <div className={styles.full}>
          <TextArea
            label="Descripción corta"
            help="La ven los docentes al abrir el módulo."
            rows={3}
            value={draft.summary}
            error={errors.summary}
            onChange={(event) => editor.setField('summary', event.target.value)}
          />
        </div>
        {isGeneral ? (
          <div className={styles.full}>
            <Select
              label="Parte del plan"
              options={tree.sections.map((section) => ({
                value: section.id,
                label: section.title,
              }))}
              value={draft.sectionId}
              error={errors.sectionId}
              onChange={(event) => editor.setField('sectionId', event.target.value)}
            />
          </div>
        ) : null}
        <TextInput
          label="Porcentaje para aprobar el Desafío"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={draft.approvalThreshold}
          error={errors.approvalThreshold}
          help="De 0 a 100. Cuenta solo si el módulo tiene preguntas del Desafío."
          onChange={(event) => editor.setField('approvalThreshold', event.target.value)}
        />
        <TextInput
          label="Segundos por pregunta"
          type="number"
          inputMode="numeric"
          min={5}
          max={120}
          value={draft.secondsPerQuestion}
          error={errors.secondsPerQuestion}
          help="Vacío usa el tiempo de cada tipo de pregunta."
          onChange={(event) => editor.setField('secondsPerQuestion', event.target.value)}
        />
      </div>

      <section className={styles.summary} aria-labelledby="completion-title">
        <h3 id="completion-title" className={styles.summaryTitle}>
          Cómo se termina este módulo
        </h3>
        {summary.firstProgressOnly ? (
          <p className={styles.summaryNote}>
            {summary.items.length === 0 && detail.activities.length === 0
              ? 'El módulo todavía no tiene contenidos. '
              : ''}
            Sin elementos obligatorios, el docente lo da por terminado con su primer avance.
          </p>
        ) : (
          <ul className={styles.summaryList}>
            {summary.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}
