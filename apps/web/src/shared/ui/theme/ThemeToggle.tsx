'use client';

import { useSyncExternalStore } from 'react';

import { SegmentedFilter } from '../components/SegmentedFilter';
import { THEME_OPTIONS } from './theme-options';
import { applyThemeChoice, readThemeChoice, saveThemeChoice, type ThemeChoice } from './theme';

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function setChoice(choice: ThemeChoice): void {
  saveThemeChoice(choice);
  listeners.forEach((listener) => listener());
}

function readServerChoice(): ThemeChoice {
  return 'system';
}

/** Selector de tema de solo iconos: grupo de opción única con flechas, Inicio y Fin. */
export function ThemeToggle() {
  // En el servidor no hay preferencia: se asume «sistema» y el cliente la corrige al hidratar.
  const choice = useSyncExternalStore(subscribe, readThemeChoice, readServerChoice);

  return (
    <SegmentedFilter
      label="Tema de la plataforma"
      options={THEME_OPTIONS}
      iconOnly
      value={choice}
      onChange={(next) => {
        applyThemeChoice(next);
        setChoice(next);
      }}
    />
  );
}
