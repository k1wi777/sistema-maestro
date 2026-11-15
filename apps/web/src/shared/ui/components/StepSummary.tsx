import type { ReactNode } from 'react';

import { Icon } from '../icons/Icon';
import { Button } from './Button';
import { cx } from './cx';
import styles from './StepSummary.module.css';

export interface StepSummaryItem {
  id: string;
  title: string;
  /** Lo que falta o un resumen corto del contenido. */
  detail: string;
  complete: boolean;
}

export interface StepSummaryProps {
  items: StepSummaryItem[];
  onGoToStep: (stepId: string) => void;
  /** Nota previa al envío (qué pasa al enviar). */
  note?: ReactNode;
  submitLabel: string;
  /** Texto del botón de cada ítem («Ir al paso» por defecto). */
  goLabel?: string;
  onSubmit: () => void;
  /** Si algo falta, el envío queda deshabilitado salvo que la feature lo permita. */
  submitDisabled?: boolean;
  className?: string;
}

/** Último paso: lista cada sección como completa o faltante y termina en la zona de envío. */
export function StepSummary({
  items,
  onGoToStep,
  note,
  submitLabel,
  goLabel = 'Ir al paso',
  onSubmit,
  submitDisabled,
  className,
}: StepSummaryProps) {
  const missing = items.filter((item) => !item.complete).length;

  return (
    <div className={className}>
      <p className={styles.count} role="status">
        {missing === 0
          ? 'Todas las secciones están completas.'
          : `Falta contenido en ${missing} ${missing === 1 ? 'sección' : 'secciones'}.`}
      </p>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={cx(styles.item, !item.complete && styles.missing)}>
            <span className={styles.icon}>
              <Icon name={item.complete ? 'check' : 'alerta'} size={16} />
            </span>
            <div className={styles.body}>
              <b>{item.title}</b>
              <span className={styles.detail}>
                <span className="sr-only">{item.complete ? 'Completo. ' : 'Falta. '}</span>
                {item.detail}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => onGoToStep(item.id)}>
              {goLabel}
              <span className="sr-only">{`: ${item.title}`}</span>
            </Button>
          </li>
        ))}
      </ul>
      <div className={styles.submit}>
        {note ? <p className={styles.note}>{note}</p> : null}
        <Button endIcon="enviar" onClick={onSubmit} disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
