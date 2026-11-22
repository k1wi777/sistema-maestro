import type { UserRole } from '@gns/shared';

import { equivalentPath } from './equivalent-path';
import { homePathFor, isProtectedRoute, roleCanUse } from './route-access';
import type { SessionState } from './session-state';

export const RETURN_PARAM = 'volver';
export const REASON_PARAM = 'motivo';
export const SESSION_EXPIRED_REASON = 'sesion-vencida';

// Barras invertidas y caracteres de control: los navegadores los normalizan a rutas externas.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARACTERS = /[\\\u0000-\u001f\u007f]/;

/**
 * Ruta de retorno segura tras el ingreso: solo una ruta interna protegida de la vista del rol o
 * su ruta equivalente (coordinación ↔ administración); cualquier otra cosa (URL externa,
 * `//host`, `/\host`, rutas desconocidas o de otra vista) se ignora y se usa la vista propia
 * del rol, de modo que no hay redirección abierta.
 */
export function safeReturnPath(value: string | null | undefined, role: UserRole): string {
  const fallback = homePathFor(role);
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }
  if (UNSAFE_CHARACTERS.test(value)) {
    return fallback;
  }
  const path = value.split(/[?#]/)[0] ?? '';
  const segment = `/${path.slice(1).split('/')[0] ?? ''}`;
  if (!isProtectedRoute(segment)) {
    return fallback;
  }
  if (roleCanUse(segment, role)) {
    return value;
  }
  const equivalent = equivalentPath(path, role);
  return equivalent === null ? fallback : `${equivalent}${value.slice(path.length)}`;
}

/** Destino de `/ingreso` para quien debe aceptar el aviso de datos estando en `pathname`. */
export function consentPath(pathname: string): string {
  return `/ingreso?${RETURN_PARAM}=${encodeURIComponent(pathname)}`;
}

/** Destino de `/ingreso` para quien debe iniciar sesión estando en `pathname`. */
export function loginPath(state: SessionState, pathname: string): string {
  if (state.status === 'anonymous' && state.signedOut) {
    return '/ingreso';
  }
  const params = new URLSearchParams();
  if (state.status === 'ended') {
    params.set(REASON_PARAM, SESSION_EXPIRED_REASON);
  }
  params.set(RETURN_PARAM, pathname);
  return `/ingreso?${params.toString()}`;
}
