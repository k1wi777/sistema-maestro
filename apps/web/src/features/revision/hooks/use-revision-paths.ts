'use client';

import { useMemo } from 'react';

import { useView } from '@/shared/shell';

import { revisionPaths, type RevisionPaths } from '../model/paths';

/** Rutas de revisión de la vista actual (`/coordinacion/...` o `/administracion/...`). */
export function useRevisionPaths(): RevisionPaths {
  const { path } = useView();
  return useMemo(() => revisionPaths(path), [path]);
}
