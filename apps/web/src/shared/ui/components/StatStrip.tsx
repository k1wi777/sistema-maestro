import type { ReactNode } from 'react';

import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/registry';
import { cx } from './cx';
import styles from './StatStrip.module.css';

export interface StatItem {
  key: string;
  /** Icono decorativo de la baldosa. */
  icon: IconName;
  /** Cifra (o «…» mientras carga). */
  value: ReactNode;
  label: string;
  /** Solo con `onSelect`: la cifra filtra y esta bandera indica si está elegida. */
  selected?: boolean;
  /** Si existe, la cifra es un botón `aria-pressed`; si no, es solo texto. */
  onSelect?: () => void;
  /** Cifra aún sin cargar (`aria-busy`). */
  busy?: boolean;
}

export interface StatStripProps {
  /** Nombre accesible de la lista de cifras. */
  label: string;
  items: StatItem[];
  /** Sin el foco rojo de la primera cifra (administración consulta y no revisa). */
  neutral?: boolean;
  className?: string;
}

/** Franja unida de indicadores: cifra grande, icono y, si filtra, filo rojo en la elegida. */
export function StatStrip({ label, items, neutral = false, className }: StatStripProps) {
  return (
    <ul className={cx(styles.strip, neutral && styles.neutral, className)} aria-label={label}>
      {items.map((item) => {
        const content = (
          <>
            <span className={styles.icon} aria-hidden="true">
              <Icon name={item.icon} size={18} />
            </span>
            <span className={styles.value} aria-busy={item.busy ? true : undefined}>
              {item.value}
            </span>
            <span className={styles.label}>{item.label}</span>
          </>
        );
        return (
          <li key={item.key} className={styles.item}>
            {item.onSelect ? (
              <button
                type="button"
                className={cx(styles.cell, styles.button)}
                aria-pressed={item.selected ?? false}
                data-selected={item.selected ? 'true' : undefined}
                onClick={item.onSelect}
              >
                {content}
              </button>
            ) : (
              <div className={styles.cell}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
