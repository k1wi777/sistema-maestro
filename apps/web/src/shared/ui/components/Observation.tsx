import type { ReactNode } from 'react';

import { Icon } from '../icons/Icon';
import { cx } from './cx';
import styles from './Observation.module.css';

export interface ObservationProps {
  title?: string;
  author?: string;
  /** Fecha ya formateada para mostrar. */
  date?: string;
  className?: string;
  children: ReactNode;
}

/** Nota de coordinación: marca roja e icono en tono, sin filo lateral grueso. */
export function Observation({
  title = 'Observación',
  author,
  date,
  className,
  children,
}: ObservationProps) {
  return (
    <aside role="note" className={cx(styles.observation, className)}>
      <Icon name="comentario" size={20} fill="tone" className={styles.icon} />
      <div className={styles.body}>
        <strong className={styles.title}>{title}</strong>
        <div className={styles.text}>{children}</div>
        {author || date ? (
          <p className={styles.byline}>{[author, date].filter(Boolean).join(' · ')}</p>
        ) : null}
      </div>
    </aside>
  );
}
