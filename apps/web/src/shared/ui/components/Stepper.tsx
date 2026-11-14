'use client';

import { Icon } from '../icons/Icon';
import { cx } from './cx';
import styles from './Stepper.module.css';

export type StepState = 'done' | 'current' | 'adjusted' | 'empty' | 'pending';
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface StepperStep {
  id: string;
  title: string;
  hint?: string;
  /** Estado de avance del paso; el actual lo marca `currentId`. */
  state: Exclude<StepState, 'current'>;
}

export interface StepperProps {
  /** Nombre accesible de la navegación («Pasos de la planeación»). */
  label: string;
  steps: StepperStep[];
  currentId: string;
  /** Punto donde la feature guarda el paso que se deja. El componente no guarda nada. */
  onStepChange: (nextId: string) => void;
  saveState?: SaveState;
  className?: string;
}

const STATE_TEXT: Record<StepState, string> = {
  done: 'completo',
  current: 'paso actual',
  adjusted: 'ajustado por coordinación',
  empty: 'sin contenido',
  pending: 'pendiente',
};

const SAVE_TEXT: Record<SaveState, string> = {
  idle: '',
  saving: 'Guardando…',
  saved: 'Guardado',
  error: 'No se pudo guardar',
};

/** Barra de pasos libres (se puede saltar a cualquiera) para formularios largos. */
export function Stepper({
  label,
  steps,
  currentId,
  onStepChange,
  saveState = 'idle',
  className,
}: StepperProps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentId),
  );
  const current = steps[currentIndex];
  const completed = steps.filter(
    (step) => step.state === 'done' || step.state === 'adjusted',
  ).length;
  const progress = steps.length === 0 ? 0 : Math.round((completed / steps.length) * 100);

  return (
    <div className={cx(styles.stepper, className)}>
      <nav aria-label={label}>
        <ol className={styles.list}>
          {steps.map((step, index) => {
            const isCurrent = step.id === currentId;
            const state: StepState = isCurrent ? 'current' : step.state;
            return (
              <li key={step.id} className={cx(styles.item, styles[state])}>
                <button
                  type="button"
                  className={styles.button}
                  aria-current={isCurrent ? 'step' : undefined}
                  onClick={() => onStepChange(step.id)}
                >
                  <span className={styles.numeral}>
                    {state === 'done' ? <Icon name="check" size={16} /> : index + 1}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.title}>{step.title}</span>
                    {step.hint ? <span className={styles.hint}>{step.hint}</span> : null}
                    <span className="sr-only">{`, ${STATE_TEXT[state]}`}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <div className={styles.progress} aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className={styles.mobile}>
        <span className={styles.mobileStep}>{`Paso ${currentIndex + 1} de ${steps.length}`}</span>
        <b className={styles.mobileTitle}>{current?.title}</b>
      </div>
      <p
        className={cx(styles.save, saveState === 'error' && styles.saveError)}
        role="status"
        aria-live="polite"
      >
        {SAVE_TEXT[saveState]}
      </p>
    </div>
  );
}
