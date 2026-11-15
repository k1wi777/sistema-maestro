import type { ApiResult } from '@/shared/api';

import {
  getMyAssignments,
  listPeriods,
  type AssignmentGrade,
  type CatalogPeriod,
} from '../api/catalogs';
import { useRemote, type RemoteState } from '@/shared/data';

/** Lo que el docente puede planear: sus asignaciones activas y los periodos del año vigente. */
export interface TeachingContext {
  schoolYear: string;
  grades: AssignmentGrade[];
  periods: CatalogPeriod[];
}

/** Respuesta 409 de la API cuando no hay un año lectivo vigente. */
export const NO_SCHOOL_YEAR_STATUS = 409;

async function loadTeachingContext(): Promise<ApiResult<TeachingContext>> {
  const assignments = await getMyAssignments();
  if (!assignments.ok) {
    return assignments;
  }
  const periods = await listPeriods(assignments.data.schoolYear);
  if (!periods.ok) {
    return periods;
  }
  return {
    ok: true,
    data: {
      schoolYear: assignments.data.schoolYear,
      grades: assignments.data.grades,
      periods: [...periods.data].sort((a, b) => a.number - b.number),
    },
  };
}

/** Carga una vez las asignaciones del docente y los periodos del año vigente. */
export function useTeachingContext(): { state: RemoteState<TeachingContext>; reload: () => void } {
  return useRemote(loadTeachingContext, 'teaching-context');
}
