'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/registry';
import { Button, type ButtonVariant } from './Button';
import { cx } from './cx';
import styles from './ActionMenu.module.css';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
  onSelect: () => void;
}

export interface ActionMenuProps {
  /** Texto del botón que abre el menú. */
  label: string;
  /** Nombre accesible del botón si el texto se oculta en pantallas angostas. */
  ariaLabel?: string;
  icon?: IconName;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  items: ActionMenuItem[];
  /** Sin valor, se coloca hacia donde haya más espacio. */
  placement?: 'up' | 'down';
  /** Oculta el texto del botón en celular (queda solo el icono). */
  collapseLabel?: boolean;
  className?: string;
}

/**
 * Menú de acciones (patrón WAI-ARIA de botón de menú): flechas, Inicio y Fin mueven el foco,
 * Escape y un clic fuera lo cierran y devuelven el foco al botón.
 */
export function ActionMenu({
  label,
  ariaLabel,
  icon,
  variant = 'outline',
  size = 'md',
  items,
  placement,
  collapseLabel,
  className,
}: ActionMenuProps) {
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const startIndex = useRef(0);
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'up' | 'down'>(placement ?? 'down');

  function triggerButton(): HTMLButtonElement | null {
    return wrapperRef.current?.querySelector('button') ?? null;
  }

  function openMenu(start: 'first' | 'last') {
    const trigger = triggerButton();
    if (placement) {
      setDirection(placement);
    } else if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      setDirection(below < 280 && rect.top > below ? 'up' : 'down');
    }
    startIndex.current = start === 'first' ? 0 : items.length - 1;
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) {
      triggerButton()?.focus();
    }
  }

  useEffect(() => {
    if (open) {
      itemRefs.current[startIndex.current]?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function moveFocus(from: number, step: 1 | -1) {
    const count = items.length;
    for (let offset = 1; offset <= count; offset += 1) {
      const next = (((from + step * offset) % count) + count) % count;
      if (!items[next]?.disabled) {
        itemRefs.current[next]?.focus();
        return;
      }
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(index, 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(index, -1);
        break;
      case 'Home':
        event.preventDefault();
        moveFocus(-1, 1);
        break;
      case 'End':
        event.preventDefault();
        moveFocus(items.length, -1);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (open || event.target !== triggerButton()) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openMenu('first');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu('last');
    }
  }

  return (
    <div ref={wrapperRef} className={cx(styles.wrapper, className)} onKeyDown={onTriggerKeyDown}>
      <Button
        variant={variant}
        size={size}
        startIcon={icon}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        className={collapseLabel ? styles.collapse : undefined}
        onClick={() => (open ? close(false) : openMenu('first'))}
      >
        {label}
      </Button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={ariaLabel ?? label}
          className={cx(styles.menu, direction === 'up' ? styles.up : styles.down)}
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              className={styles.item}
              disabled={item.disabled}
              onKeyDown={(event) => onMenuKeyDown(event, index)}
              onClick={() => {
                close(true);
                item.onSelect();
              }}
            >
              {item.icon ? <Icon name={item.icon} size={18} /> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
