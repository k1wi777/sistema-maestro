import type { ReactNode } from 'react';

import { cx } from './cx';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  /** Rótulo de contexto sobre el título («Docente», «Coordinación»…). */
  context?: string;
  title: string;
  description?: string;
  /** Acciones de la página, a la derecha del título. */
  actions?: ReactNode;
  className?: string;
}

/** Encabezado de página: rótulo con trazo rojo, título y acciones. */
export function PageHeader({ context, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cx(styles.header, className)}>
      <div className={styles.text}>
        {context ? <p className={styles.context}>{context}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
