import { UserRole, roleSatisfies } from '@gns/shared';

import type { SessionState } from './session-state';

/** Rol mínimo por ruta protegida (primer segmento). */
export const PROTECTED_ROUTES = {
  '/docente': UserRole.Teacher,
  '/coordinacion': UserRole.Coordinator,
} as const satisfies Record<string, UserRole>;

export type ProtectedRoute = keyof typeof PROTECTED_ROUTES;

export function isProtectedRoute(segment: string): segment is ProtectedRoute {
  return Object.hasOwn(PROTECTED_ROUTES, segment);
}

/** Vista propia de cada rol: docente a la suya; coordinación y administración, a coordinación. */
export function homePathFor(role: UserRole): ProtectedRoute {
  return role === UserRole.Teacher ? '/docente' : '/coordinacion';
}

export type AccessDecision =
  'loading' | 'unavailable' | 'redirect-login' | 'forbidden' | 'consent-pending' | 'allowed';

/** Qué debe mostrar una ruta protegida según la sesión (capa de experiencia; la API autoriza). */
export function decideAccess(state: SessionState, required: UserRole): AccessDecision {
  switch (state.status) {
    case 'loading':
      return 'loading';
    case 'unavailable':
      return 'unavailable';
    case 'anonymous':
    case 'ended':
      return 'redirect-login';
    case 'authenticated':
      if (!roleSatisfies(state.user.role, required)) {
        return 'forbidden';
      }
      return state.consent === 'pending' ? 'consent-pending' : 'allowed';
  }
}
