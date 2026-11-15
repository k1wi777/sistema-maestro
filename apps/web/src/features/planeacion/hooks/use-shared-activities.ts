import type { SharedActivity, SharedActivityListFilters } from '@gns/shared';

import { listSharedActivities } from '../api/shared-activities';
import { usePagedList, type PagedList } from './use-paged-list';

export const ACTIVITY_PAGE_SIZE = 12;

/** Actividades del repositorio con los filtros indicados (`pageSize` configurable para las ideas). */
export function useSharedActivities(
  filters: SharedActivityListFilters,
  pageSize: number = ACTIVITY_PAGE_SIZE,
  enabled = true,
): PagedList<SharedActivity> {
  const key = JSON.stringify([
    enabled,
    pageSize,
    filters.q,
    filters.levelId,
    filters.gradeId,
    filters.areaId,
    filters.learningCorner,
    filters.activityType,
    filters.authorId,
    filters.favorites,
  ]);
  return usePagedList<SharedActivity>(
    async (page) =>
      enabled
        ? listSharedActivities({ ...filters, page, pageSize })
        : {
            ok: true,
            data: { items: [], page: 1, pageSize, totalItems: 0, totalPages: 0 },
          },
    key,
  );
}
