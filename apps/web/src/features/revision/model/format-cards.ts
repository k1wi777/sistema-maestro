import type { FillableIconName } from '@/shared/ui';

import type { RevisionPaths } from './paths';

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

/** Formatos de coordinación y administración, en el orden del hub (`<vista>/formatos`). */
export function reviewFormatCards(
  paths: RevisionPaths,
  consultOnly: boolean,
): readonly ReviewFormatCardData[] {
  return [
    {
      id: 'planeaciones',
      title: 'Planeaciones',
      description: consultOnly
        ? 'Todos los grados · Solo consulta'
        : 'Revisa, ajusta, aprueba o devuelve las planeaciones.',
      icon: 'plan',
      href: paths.plans,
      pending: 'plans',
    },
    {
      id: 'diarios',
      title: 'Diarios de campo',
      description: consultOnly
        ? 'Todos los grados · Solo consulta'
        : 'Revisa el diario de cada grupo y día.',
      icon: 'formatos',
      href: paths.journals,
      pending: 'journals',
    },
    {
      id: 'observadores',
      title: 'Observadores',
      description: consultOnly
        ? 'Todos los grados · Solo consulta'
        : 'Revisa las anotaciones del observador.',
      icon: 'formatos',
      href: paths.observers,
      pending: 'notes',
    },
  ];
}

/** Texto de la cifra de pendientes de una tarjeta de coordinación («… en tus grados»). */
export function pendingLabel(count: number): string {
  return count === 1 ? '1 pendiente en tus grados' : `${count} pendientes en tus grados`;
}

/** Cifra neutra de administración: total de registros, sin juicio de pendiente. */
export function totalLabel(count: number): string {
  return count === 1 ? '1 registro' : `${count} registros`;
}
