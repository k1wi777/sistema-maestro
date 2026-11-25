import type { ReactNode } from 'react';

import { ButtonLink } from './Button';
import { cx } from './cx';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  /** Rótulo de contexto sobre el título («Docente», «Coordinación»…). */
  context?: string;
  title: string;
  description?: string;
  /** Acciones de la página, a la derecha del título. */
  actions?: ReactNode;
  /** «Volver a…»: enlace fantasma pequeño sobre el título (no compite con las acciones). */
  back?: { href: string; label: string };
  className?: string;
}

/** Encabezado de página: rótulo con trazo rojo, título y acciones. */
export function PageHeader({
  context,
  title,
  description,
  actions,
  back,
  className,
}: PageHeaderProps) {
  return (
    <header className={cx(styles.header, className)}>
      <div className={styles.text}>
        {back ? (
          <ButtonLink
            href={back.href}
            variant="ghost"
            size="sm"
            startIcon="volver"
            className={styles.back}
          >
            {back.label}
          </ButtonLink>
        ) : null}
        {context ? <p className={styles.context}>{context}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
