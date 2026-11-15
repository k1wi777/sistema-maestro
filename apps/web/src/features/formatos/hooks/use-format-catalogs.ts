import type { ApiResult } from '@/shared/api';
import { useRemote, type Remote } from '@/shared/data';

import {
  getMyAssignments,
  listGrades,
  listLevels,
  listPeriods,
  type CatalogGrade,
  type CatalogLevel,
  type CatalogPeriod,
} from '../api/catalogs';

/** Respuesta 409 de la API cuando no hay un año lectivo vigente. */
export const NO_SCHOOL_YEAR_STATUS = 409;

/** Dónde puede abrir una hoja de diario: sus grados asignados y los periodos del año vigente. */
export interface JournalTargets {
  schoolYear: string;
  grades: { id: string; name: string; sortOrder: number }[];
  periods: CatalogPeriod[];
}

async function loadJournalTargets(): Promise<ApiResult<JournalTargets>> {
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
      grades: assignments.data.grades
        .map((entry) => entry.grade)
        .sort((a, b) => a.sortOrder - b.sortOrder),
      periods: [...periods.data].sort((a, b) => a.number - b.number),
    },
  };
}

/** Grados asignados y periodos vigentes para crear una hoja (409 si no hay año vigente). */
export function useJournalTargets(): Remote<JournalTargets> {
  return useRemote(loadJournalTargets, 'journal-targets');
}

/** Catálogo completo de grados con su nivel (el encabezado de una hoja antigua puede ser de un grado ya no asignado). */
export interface GradeCatalog {
  grades: (CatalogGrade & { levelName: string | null })[];
  levels: CatalogLevel[];
}

async function loadGradeCatalog(): Promise<ApiResult<GradeCatalog>> {
  const [grades, levels] = await Promise.all([listGrades(), listLevels()]);
  if (!grades.ok) {
    return grades;
  }
  if (!levels.ok) {
    return levels;
  }
  const levelName = new Map(levels.data.map((level) => [level.id, level.name]));
  return {
    ok: true,
    data: {
      levels: [...levels.data].sort((a, b) => a.sortOrder - b.sortOrder),
      grades: [...grades.data]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((grade) => ({ ...grade, levelName: levelName.get(grade.levelId) ?? null })),
    },
  };
}

/** Grados y niveles del catálogo: nivel del encabezado del diario y grados del observador. */
export function useGradeCatalog(): Remote<GradeCatalog> {
  return useRemote(loadGradeCatalog, 'grade-catalog');
}
