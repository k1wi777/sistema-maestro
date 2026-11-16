'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

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

// Pestañas que navegan (cada pestaña es una página): al cambiar, la página se vuelve a montar y el
// foco caería al cuerpo. La pestaña que originó el cambio deja su nombre en `sessionStorage` y la
// página nueva devuelve el foco a su pestaña activa al montarse.
const PENDING_FOCUS_KEY = 'gns:tabs:focus';

function readPendingFocus(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_FOCUS_KEY);
  } catch {
    return null;
  }
}

function writePendingFocus(label: string | null): void {
  try {
    if (label === null) {
      window.sessionStorage.removeItem(PENDING_FOCUS_KEY);
    } else {
      window.sessionStorage.setItem(PENDING_FOCUS_KEY, label);
    }
  } catch {
    // Sin almacenamiento disponible solo se pierde la devolución del foco.
  }
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
  const activeIdRef = useRef(activeId);
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  const labelRef = useRef(label);

  // Al montar: recupera el foco si la navegación la originó una pestaña de este mismo grupo.
  useEffect(() => {
    if (readPendingFocus() === labelRef.current) {
      writePendingFocus(null);
      refs.current.get(activeIdRef.current)?.focus({ preventScroll: true });
    }
  }, []);

  // La pestaña activa siempre queda a la vista, también cuando la lista se desplaza (celular).
  useEffect(() => {
    refs.current.get(activeId)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeId]);

  function select(id: string) {
    if (value !== undefined && id !== value) {
      writePendingFocus(label);
    }
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
