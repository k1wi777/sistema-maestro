import type { UserRole } from '@gns/shared';

import type { ProtectedRoute, SessionState } from '@/shared/session';

/** Qué pinta `/ingreso`: el formulario, el aviso de datos, la selección de vista o una navegación. */
export type IngresoView =
  | { kind: 'form'; busy: boolean }
  | { kind: 'consent' }
  | { kind: 'chooser' }
  | { kind: 'navigate'; to: string };

/** Reglas de acceso de `shared/session` que la decisión necesita (se inyectan para probarla sin React). */
export interface IngresoRules {
  safeReturnPath: (value: string | null | undefined, role: UserRole) => string;
  availableViews: (role: UserRole) => ProtectedRoute[];
}

/**
 * Decide qué muestra `/ingreso` según la sesión y la ruta de retorno (`volver`).
 * - Sin sesión (o con la API caída): el formulario; mientras carga, el formulario sin poder enviarse.
 * - Con sesión y aviso pendiente: el aviso, antes que cualquier vista o sección.
 * - Con el aviso aceptado: la ruta de retorno si es segura; si el rol solo alcanza una vista,
 *   esa vista; si no, la selección de vista.
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
      if (returnTo !== null && safe === returnTo) {
        return { kind: 'navigate', to: safe };
      }
      const views = rules.availableViews(role);
      const only = views.length === 1 ? views[0] : undefined;
      return only ? { kind: 'navigate', to: only } : { kind: 'chooser' };
    }
  }
}
