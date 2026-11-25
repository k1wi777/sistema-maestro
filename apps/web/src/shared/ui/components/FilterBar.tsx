import type { ReactNode } from 'react';

import { cx } from './cx';
import styles from './FilterBar.module.css';

export interface FilterBarProps {
  /** Nombre accesible del grupo de filtros. */
  label: string;
  /** Un solo control: sin ancho mínimo por hijo (p. ej. un buscador). */
  compact?: boolean;
  className?: string;
  /** Controles con `size="sm"` (`Select`, `TextInput`). */
  children: ReactNode;
}

/** Barra gris de filtros del tablero: separa lo que filtra de lo filtrado. */
export function FilterBar({ label, compact = false, className, children }: FilterBarProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(styles.bar, compact && styles.compact, className)}
    >
      {children}
    </div>
  );
}
