import type { SegmentedOption } from '../components/SegmentedFilter';
import type { ThemeChoice } from './theme';

/** Orden del tablero v50: Claro, Oscuro y Sistema (el defecto), cada uno con su icono. */
export const THEME_OPTIONS: SegmentedOption<ThemeChoice>[] = [
  { value: 'light', label: 'Claro', icon: 'sol' },
  { value: 'dark', label: 'Oscuro', icon: 'luna' },
  { value: 'system', label: 'Sistema', icon: 'pantalla' },
];
