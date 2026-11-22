import type { UserRole } from '@gns/shared';

import type { SessionState } from '@/shared/session';

/** Qué pinta `/ingreso`: el formulario, el aviso de datos o una navegación. */
export type IngresoView =
  { kind: 'form'; busy: boolean } | { kind: 'consent' } | { kind: 'navigate'; to: string };

/** Reglas de acceso de `shared/session` que la decisión necesita (se inyectan para probarla sin React). */
export interface IngresoRules {
  safeReturnPath: (value: string | null | undefined, role: UserRole) => string;
  /** Vista propia del rol (raíz de la vista: `/docente`, `/coordinacion` o `/administracion`). */
  homePath: (role: UserRole) => string;
  /** Primera sección del menú de la vista del rol. */
  homeSection: (role: UserRole) => string;
}

/**
 * Decide qué muestra `/ingreso` según la sesión y la ruta de retorno (`volver`).
 * - Sin sesión (o con la API caída): el formulario; mientras carga, el formulario sin poder enviarse.
 * - Con sesión y aviso pendiente: el aviso, antes que cualquier vista o sección.
 * - Con el aviso aceptado: la ruta de retorno si es segura (de la vista del rol o su equivalente);
 *   si no, la primera sección de la vista del rol. Cada rol tiene una sola vista: no hay selección.
 */
export function ingresoView(
  state: SessionState,
  returnTo: string | null,
  rules: IngresoRules,
): IngresoView {
  switch (state.status) {
    case 'loading':
      return { kind: 'form', busy: true };
    case 'anonymous':
    case 'ended':
    case 'unavailable':
      return { kind: 'form', busy: false };
    case 'authenticated': {
      if (state.consent === 'pending') {
        return { kind: 'consent' };
      }
      const role = state.user.role;
      const safe = rules.safeReturnPath(returnTo, role);
      // Sin retorno útil, `safe` es la raíz de la vista: se lleva a su primera sección.
      return {
        kind: 'navigate',
        to: returnTo !== null && safe !== rules.homePath(role) ? safe : rules.homeSection(role),
      };
    }
  }
}
