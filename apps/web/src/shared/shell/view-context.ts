'use client';

import { createContext, useContext } from 'react';

import type { ProtectedRoute } from '../session/route-access';

/** La vista en la que está la persona: la usan las features para armar sus rutas y encabezados. */
export interface CurrentView {
  /** Raíz de la vista: `/docente`, `/coordinacion` o `/administracion`. */
  path: ProtectedRoute;
  /** Título de la vista («Coordinación académica», «Administración»…). */
  title: string;
}

export const ViewContext = createContext<CurrentView | null>(null);

/**
 * Vista actual. Planes, Avance, Asistente y Formatos se reutilizan en coordinación y en
 * administración: sus rutas internas y su encabezado salen de aquí en lugar de ser constantes.
 */
export function useView(): CurrentView {
  const view = useContext(ViewContext);
  if (!view) {
    throw new Error('useView debe usarse dentro de AppShell.');
  }
  return view;
}
