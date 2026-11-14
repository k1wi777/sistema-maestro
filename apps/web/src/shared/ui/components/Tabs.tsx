'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { cx } from './cx';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  /** Nombre accesible del grupo de pestañas. */
  label: string;
  tabs: TabItem[];
  /** Pestaña activa (controlado). Sin él, el componente guarda su propio estado. */
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  className?: string;
}

/**
 * Pestañas de una sola variante (subrayado rojo). Patrón WAI-ARIA con activación
 * automática: flechas, Inicio y Fin mueven el foco y activan la pestaña.
 */
export function Tabs({ label, tabs, value, defaultValue, onChange, className }: TabsProps) {
  const baseId = useId();
  const [inner, setInner] = useState(defaultValue ?? tabs[0]?.id ?? '');
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const activeId = value ?? inner;
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  function select(id: string) {
    setInner(id);
    onChange?.(id);
    refs.current.get(id)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const targets: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const target = targets[event.key];
    const next = target === undefined ? undefined : tabs[target];
    if (next) {
      event.preventDefault();
      select(next.id);
    }
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className={styles.list}>
        {tabs.map((tab, index) => {
          const selected = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) refs.current.set(tab.id, node);
                else refs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={cx(styles.tab, selected && styles.selected)}
              onClick={() => select(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.id}`}
          aria-labelledby={`${baseId}-tab-${active.id}`}
          tabIndex={0}
          className={styles.panel}
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
