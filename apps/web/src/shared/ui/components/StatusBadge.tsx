import type { ReactNode } from 'react';

import { cx } from './cx';
import styles from './StatusBadge.module.css';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface StatusBadgeProps {
  tone?: StatusTone;
  className?: string;
  children: ReactNode;
}

/** Píldora con punto. No conoce los estados del dominio: cada feature elige el tono. */
export function StatusBadge({ tone = 'neutral', className, children }: StatusBadgeProps) {
  return <span className={cx(styles.badge, styles[tone], className)}>{children}</span>;
}
