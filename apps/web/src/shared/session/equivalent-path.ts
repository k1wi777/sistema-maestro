import type { UserRole } from '@gns/shared';

import { VIEWS, isActiveSection, sectionsOf } from '../shell/navigation';
import { homePathFor, isProtectedRoute, roleCanUse, type ProtectedRoute } from './route-access';

/** Las dos vistas de personal comparten secciones con el mismo nombre de ruta. */
const STAFF_VIEWS: readonly ProtectedRoute[] = ['/coordinacion', '/administracion'];

/**
 * Ruta equivalente de `pathname` en la vista propia de `role`: si la ruta es de otra vista de
 * personal (coordinación ↔ administración) y el resto del camino es una sección del menú de la
 * vista del rol, devuelve esa ruta (p. ej. `/coordinacion/formatos/planeaciones/abc` →
 * `/administracion/formatos/planeaciones/abc`). Si no existe equivalente, `null`: se muestra el
 * aviso de acceso. Es experiencia; la API sigue autorizando.
 */
export function equivalentPath(pathname: string, role: UserRole): string | null {
  const own = homePathFor(role);
  if (!STAFF_VIEWS.includes(own)) {
    return null;
  }
  const segment = `/${pathname.slice(1).split('/')[0] ?? ''}`;
  if (segment === own || !isProtectedRoute(segment) || !STAFF_VIEWS.includes(segment)) {
    return null;
  }
  if (roleCanUse(segment, role)) {
    return null;
  }
  const candidate = `${own}${pathname.slice(segment.length)}`;
  const known = sectionsOf(VIEWS[own]).some((section) => isActiveSection(candidate, section.href));
  return known ? candidate : null;
}
