'use client';

import type { LessonPlan, LessonPlanCompliance, RecordStatus } from '@gns/shared';

import type { ApiResult } from '@/shared/api';
import { usePagedList, useRemote, type PagedList, type Remote } from '@/shared/data';

import { listAreas, listGrades, type CatalogArea, type CatalogGrade } from '../api/catalogs';
import { getCompliance } from '../api/compliance';
import { listPlans } from '../api/lesson-plans';
import {
  INDICATOR_STATUSES,
  planFiltersKey,
  withoutStatus,
  type PlanFilters,
} from '../model/plan-filters';

const PAGE_SIZE = 20;

/** Planeaciones de todos los docentes con los filtros activos y «Cargar más». */
export function usePlanList(filters: PlanFilters): PagedList<LessonPlan> {
  return usePagedList<LessonPlan>(
    (page) => listPlans({ ...filters, page, pageSize: PAGE_SIZE }),
    planFiltersKey(filters),
  );
}

export type PlanIndicators = Record<RecordStatus, number>;

async function loadIndicators(filters: PlanFilters): Promise<ApiResult<PlanIndicators>> {
  // Cada cifra es la misma consulta con una sola fila y el total que informa la página.
  const pages = await Promise.all(
    INDICATOR_STATUSES.map((status) => listPlans({ ...filters, status, page: 1, pageSize: 1 })),
  );
  const counts: Partial<PlanIndicators> = {};
  for (const [index, page] of pages.entries()) {
    if (!page.ok) {
      return page;
    }
    counts[INDICATOR_STATUSES[index]!] = page.data.totalItems;
  }
  return { ok: true, data: counts as PlanIndicators };
}

/** Pendientes, con observaciones, revisadas y borradores según los filtros (salvo el estado). */
export function usePlanIndicators(filters: PlanFilters): Remote<PlanIndicators> {
  const base = withoutStatus(filters);
  return useRemote(() => loadIndicators(base), `indicators:${planFiltersKey(base)}`);
}

/**
 * Cumplimiento del año vigente de todos los docentes y periodos: la pantalla elige el periodo y
 * filtra por docente, y de aquí salen también las opciones de docente y periodo de los filtros
 * (con un filtro de docente en la petición esas opciones se reducirían a una).
 */
export function useCompliance(): Remote<LessonPlanCompliance> {
  return useRemote(() => getCompliance({}), 'compliance');
}

export interface InboxCatalogs {
  grades: CatalogGrade[];
  areas: CatalogArea[];
}

async function loadCatalogs(): Promise<ApiResult<InboxCatalogs>> {
  const [grades, areas] = await Promise.all([listGrades(), listAreas()]);
  if (!grades.ok) {
    return grades;
  }
  if (!areas.ok) {
    return areas;
  }
  return {
    ok: true,
    data: {
      grades: [...grades.data].sort((a, b) => a.sortOrder - b.sortOrder),
      areas: [...areas.data].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    },
  };
}

/** Grados y áreas del catálogo para los filtros. */
export function useInboxCatalogs(): Remote<InboxCatalogs> {
  return useRemote(loadCatalogs, 'revision-catalogs');
}
