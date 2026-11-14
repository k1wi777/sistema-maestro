import type { ElementType, ReactNode } from 'react';

import { cx } from './cx';
import styles from './Card.module.css';

export interface CardProps {
  title?: string;
  /** Nivel del encabezado para no romper la jerarquía de la página. */
  headingLevel?: 2 | 3;
  /** Número del paso, a la izquierda del título. */
  step?: number;
  actions?: ReactNode;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

/** Bloque de contenido con una sola elevación. No se anidan tarjetas dentro de tarjetas. */
export function Card({
  title,
  headingLevel = 2,
  step,
  actions,
  as: Tag = 'section',
  className,
  children,
}: CardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Tag className={cx(styles.card, className)}>
      {title || actions ? (
        <header className={styles.header}>
          {step !== undefined ? (
            <span className={styles.step} aria-hidden="true">
              {step}
            </span>
          ) : null}
          {title ? <Heading className={styles.title}>{title}</Heading> : null}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </Tag>
  );
}
