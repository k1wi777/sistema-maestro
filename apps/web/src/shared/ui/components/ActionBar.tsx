import type { ReactNode } from 'react';

import { cx } from './cx';
import styles from './ActionBar.module.css';

export interface ActionBarProps {
  /** Estado o acciones secundarias, a la izquierda. */
  status?: ReactNode;
  /** Acciones, con la principal al final (derecha). */
  children: ReactNode;
  className?: string;
}

/**
 * Barra de acciones flotante y translúcida, fija abajo. Incluye un espaciador en el flujo
 * para que nunca tape el final del contenido.
 */
export function ActionBar({ status, children, className }: ActionBarProps) {
  return (
    <>
      <div className={styles.spacer} aria-hidden="true" />
      <div className={cx(styles.bar, className)}>
        <div className={styles.inner}>
          {status ? <div className={styles.status}>{status}</div> : null}
          <div className={styles.actions}>{children}</div>
        </div>
      </div>
    </>
  );
}
