import type { ReactNode } from 'react';

import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/registry';
import { cx } from './cx';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  icon?: IconName;
  title?: string;
  /** Acción opcional (botón o enlace) bajo el texto. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Estado vacío: borde discontinuo centrado, con icono, título y acción opcionales. */
export function EmptyState({ icon, title, action, className, children }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, className)}>
      {icon ? <Icon name={icon} size={24} className={styles.icon} /> : null}
      {title ? <p className={styles.title}>{title}</p> : null}
      <p className={styles.text}>{children}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
