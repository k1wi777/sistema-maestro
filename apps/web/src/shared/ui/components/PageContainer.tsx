import type { ReactNode } from 'react';

import { cx } from './cx';
import styles from './PageContainer.module.css';

export interface PageContainerProps {
  className?: string;
  children: ReactNode;
}

/** Zona principal de una página: ancho de lectura y aire a los lados. */
export function PageContainer({ className, children }: PageContainerProps) {
  return <main className={cx(styles.container, className)}>{children}</main>;
}
