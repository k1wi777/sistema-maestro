'use client';

import type { AcademicStructure } from '@gns/shared';

import { useRemote, type Remote } from '@/shared/data';

import { getAcademicStructure } from '../api/structure';

/** Estructura académica completa; tras cada escritura se vuelve a pedir con `refresh`. */
export function useAcademicStructure(): Remote<AcademicStructure> {
  return useRemote(getAcademicStructure, 'academic-structure');
}
