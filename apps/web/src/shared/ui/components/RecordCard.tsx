import type { ReactNode } from 'react';

import { cx } from './cx';
import styles from './RecordCard.module.css';

export type RecordTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const HEADINGS = { 2: 'h2', 3: 'h3', 4: 'h4' } as const;

export interface RecordCardProps {
  title: string;
  headingLevel?: 2 | 3 | 4;
  /** El tono pinta el filo superior; cada feature mapea su estado a un tono. */
  tone?: RecordTone;
  /** Etiqueta de estado (normalmente un `StatusBadge`). */
  status?: ReactNode;
  /** Datos secundarios en filas cortas (fecha, grado, área). */
  meta?: ReactNode[];
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** Tarjeta de un registro (planeación, módulo, formato) con el estado en el filo superior. */
export function RecordCard({
  title,
  headingLevel = 3,
  tone = 'neutral',
  status,
  meta,
  actions,
  className,
  children,
}: RecordCardProps) {
  const Heading = HEADINGS[headingLevel];
  return (
    <article className={cx(styles.card, styles[tone], className)}>
      <div className={styles.top}>
        <Heading className={styles.title}>{title}</Heading>
        {status}
      </div>
      {meta && meta.length > 0 ? (
        <ul className={styles.meta}>
          {meta.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : null}
      {children}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </article>
  );
}
