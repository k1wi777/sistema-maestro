import type { FillableIconName } from '@/shared/ui';

import { JOURNAL_INBOX_PATH, OBSERVER_INBOX_PATH, PLAN_INBOX_PATH } from './paths';

export type PendingKey = 'plans' | 'journals' | 'notes';

export interface ReviewFormatCardData {
  id: string;
  title: string;
  description: string;
  icon: FillableIconName;
  href: string;
  /** Clave del conteo de pendientes de revisión de este formato. */
  pending: PendingKey;
}

/** Formatos que revisa coordinación, en el orden del hub (`/coordinacion/formatos`). */
export const REVIEW_FORMAT_CARDS: readonly ReviewFormatCardData[] = [
  {
    id: 'planeaciones',
    title: 'Planeaciones',
    description: 'Revisa, ajusta, aprueba o devuelve las planeaciones.',
    icon: 'plan',
    href: PLAN_INBOX_PATH,
    pending: 'plans',
  },
  {
    id: 'diarios',
    title: 'Diarios de campo',
    description: 'Revisa el diario de cada grupo y día.',
    icon: 'formatos',
    href: JOURNAL_INBOX_PATH,
    pending: 'journals',
  },
  {
    id: 'observadores',
    title: 'Observadores',
    description: 'Revisa las anotaciones del observador.',
    icon: 'formatos',
    href: OBSERVER_INBOX_PATH,
    pending: 'notes',
  },
];

/** Texto de la cifra de pendientes de una tarjeta. */
export function pendingLabel(count: number): string {
  return count === 1 ? '1 pendiente' : `${count} pendientes`;
}
