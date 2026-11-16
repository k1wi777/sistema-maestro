import type { ApiResult } from '@/shared/api';

import {
  getLessonPlanOptions,
  listPeriods,
  type LessonPlanOptionsGrade,
  type CatalogPeriod,
} from '../api/catalogs';
import { useRemote, type RemoteState } from '@/shared/data';

/** Lo que el docente puede planear: sus grados con las áreas que puede marcar y los periodos del año vigente. */
export interface TeachingContext {
  schoolYear: string;
  grades: LessonPlanOptionsGrade[];
  periods: CatalogPeriod[];
}

/** Respuesta 409 de la API cuando no hay un año lectivo vigente. */
export const NO_SCHOOL_YEAR_STATUS = 409;

async function loadTeachingContext(): Promise<ApiResult<TeachingContext>> {
  const assignments = await getLessonPlanOptions();
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

/** Carga una vez las opciones de planeación del docente y los periodos del año vigente. */
export function useTeachingContext(): { state: RemoteState<TeachingContext>; reload: () => void } {
  return useRemote(loadTeachingContext, 'teaching-context');
}
