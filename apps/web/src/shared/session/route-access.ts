import { UserRole } from '@gns/shared';

import type { SessionState } from './session-state';

/**
 * Roles que admite cada vista (primer segmento de la ruta). No hay jerarquía: cada rol tiene
 * una sola vista y no cambia de vista.
 */
export const PROTECTED_ROUTES = {
  '/docente': [UserRole.Teacher],
  '/coordinacion': [UserRole.Coordinator],
  '/administracion': [UserRole.Administrator],
} as const satisfies Record<string, readonly UserRole[]>;

export type ProtectedRoute = keyof typeof PROTECTED_ROUTES;

export function isProtectedRoute(segment: string): segment is ProtectedRoute {
  return Object.hasOwn(PROTECTED_ROUTES, segment);
}

/** Vista propia de cada rol: docente, coordinación o administración. */
export function homePathFor(role: UserRole): ProtectedRoute {
  switch (role) {
    case UserRole.Teacher:
      return '/docente';
    case UserRole.Coordinator:
      return '/coordinacion';
    case UserRole.Administrator:
      return '/administracion';
  }
}

/** El rol pertenece a los que admite la vista. */
export function roleCanUse(route: ProtectedRoute, role: UserRole): boolean {
  return (PROTECTED_ROUTES[route] as readonly UserRole[]).includes(role);
}

export type AccessDecision =
  'loading' | 'unavailable' | 'redirect-login' | 'forbidden' | 'consent-pending' | 'allowed';

/** Qué debe mostrar una ruta protegida según la sesión (capa de experiencia; la API autoriza). */
export function decideAccess(state: SessionState, allowed: readonly UserRole[]): AccessDecision {
  switch (state.status) {
    case 'loading':
      return 'loading';
    case 'unavailable':
      return 'unavailable';
    case 'anonymous':
    case 'ended':
      return 'redirect-login';
    case 'authenticated':
      if (!allowed.includes(state.user.role)) {
        return 'forbidden';
      }
      return state.consent === 'pending' ? 'consent-pending' : 'allowed';
  }
}
