import type { ApiResult } from '@/shared/api';

import {
  listAreas,
  listGrades,
  listLevels,
  type CatalogArea,
  type CatalogGrade,
  type CatalogLevel,
} from '../api/catalogs';
import { listLearningCorners } from '../api/shared-activities';
import { useRemote, type Remote } from '@/shared/data';

export interface ActivityCatalogs {
  levels: Remote<CatalogLevel[]>;
  areas: Remote<CatalogArea[]>;
  /** Grados del nivel elegido; vacío sin nivel. */
  grades: Remote<CatalogGrade[]>;
  /** Rincones o zonas en uso en el repositorio (del nivel elegido, o de todos). */
  corners: Remote<string[]>;
}

const NO_GRADES: ApiResult<CatalogGrade[]> = { ok: true, data: [] };

/** Catálogos de los filtros y del formulario del repositorio; grados y rincones siguen al nivel. */
export function useActivityCatalogs(levelId: string | undefined): ActivityCatalogs {
  const levels = useRemote(listLevels, 'levels');
  const areas = useRemote(listAreas, 'areas');
  const grades = useRemote(
    async () => (levelId ? listGrades(levelId) : NO_GRADES),
    `grades:${levelId ?? ''}`,
  );
  const corners = useRemote(() => listLearningCorners(levelId), `corners:${levelId ?? ''}`);
  return { levels, areas, grades, corners };
}

/** Datos de un catálogo ya cargado; vacío mientras carga o si falló (el filtro queda sin opciones). */
export function readyOr<T>(remote: Remote<T[]>): T[] {
  return remote.state.status === 'ready' ? remote.state.data : [];
}
