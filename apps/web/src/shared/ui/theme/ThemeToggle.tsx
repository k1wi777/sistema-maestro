'use client';

import { useSyncExternalStore } from 'react';

import { SegmentedFilter } from '../components/SegmentedFilter';
import { applyThemeChoice, readThemeChoice, saveThemeChoice, type ThemeChoice } from './theme';

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

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

export function ThemeToggle() {
  // En el servidor no hay preferencia: se asume «sistema» y el cliente la corrige al hidratar.
  const choice = useSyncExternalStore(subscribe, readThemeChoice, readServerChoice);

  return (
    <SegmentedFilter
      label="Tema de la plataforma"
      options={OPTIONS}
      value={choice}
      onChange={(next) => {
        applyThemeChoice(next);
        setChoice(next);
      }}
    />
  );
}
