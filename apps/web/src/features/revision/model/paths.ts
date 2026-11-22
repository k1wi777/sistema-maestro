import type { ProtectedRoute } from '@/shared/session';

/**
 * Rutas de la feature: la revisión de planeaciones, diarios y observadores cuelga de «Formatos» de
 * la vista de la persona (coordinación o administración reutilizan las mismas pantallas).
 */
export function revisionPaths(view: ProtectedRoute) {
  const hub = `${view}/formatos`;
  return {
    hub,
    plans: `${hub}/planeaciones`,
    journals: `${hub}/diario`,
    observers: `${hub}/observador`,
    /** Enlace de «Grado sin coordinadora»: «Grados y áreas» es de administración. */
    grades: `${view}/grados-y-areas`,
  };
}

export type RevisionPaths = ReturnType<typeof revisionPaths>;
