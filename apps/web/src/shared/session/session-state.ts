import { UserRole } from '@gns/shared';

import type { components } from '../api';

export type CurrentUser = components['schemas']['CurrentUserDto_Output'];
export type ConsentState = 'accepted' | 'pending';

export type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous'; signedOut?: boolean }
  | { status: 'authenticated'; user: CurrentUser; consent: ConsentState; policyVersion: string }
  | { status: 'unavailable' }
  | { status: 'ended' };

/** Resultado de resolver la sesión contra la API (`/auth/me` y `/consent`). */
export type Resolution =
  | { kind: 'authenticated'; user: CurrentUser; consent: ConsentState; policyVersion: string }
  | { kind: 'anonymous' }
  | { kind: 'unavailable' };

/**
 * Aplica una resolución al estado anterior. Dos reglas protegen la experiencia:
 * - una sesión terminada por renovación fallida (`ended`) no se degrada a `anonymous`: el aviso
 *   de sesión vencida depende de ella;
 * - una revalidación en segundo plano que no puede hablar con la API conserva la sesión vigente
 *   en lugar de sacar al usuario de lo que hacía.
 */
export function applyResolution(
  previous: SessionState,
  resolution: Resolution,
  background: boolean,
): SessionState {
  switch (resolution.kind) {
    case 'authenticated':
      return {
        status: 'authenticated',
        user: resolution.user,
        consent: resolution.consent,
        policyVersion: resolution.policyVersion,
      };
    case 'anonymous':
      return previous.status === 'ended' ? previous : { status: 'anonymous' };
    case 'unavailable':
      return background && previous.status === 'authenticated'
        ? previous
        : { status: 'unavailable' };
  }
}

/** La renovación falló: solo una sesión activa pasa a `ended`. */
export function endSession(previous: SessionState): SessionState {
  return previous.status === 'authenticated' ? { status: 'ended' } : previous;
}

/** La API exigió aceptar el aviso de datos: solo afecta a una sesión activa. */
export function requireConsent(previous: SessionState): SessionState {
  return previous.status === 'authenticated' ? { ...previous, consent: 'pending' } : previous;
}

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.Teacher]: 'docente',
  [UserRole.Coordinator]: 'coordinación',
  [UserRole.Administrator]: 'administración',
};

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

/** Iniciales para el avatar: la primera letra del primer y del último nombre. */
export function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return [first, last]
    .filter((word): word is string => word !== undefined)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}
