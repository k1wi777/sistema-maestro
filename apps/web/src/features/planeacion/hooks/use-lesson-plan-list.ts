import type { LessonPlan, LessonPlanFilters } from '@gns/shared';

import { listLessonPlans } from '../api/lesson-plans';
import { usePagedList, type PagedList } from './use-paged-list';

export const LESSON_PLAN_PAGE_SIZE = 20;

/**
 * Planeaciones del docente en sesión. `teacherId` va siempre: a un docente la API se lo fuerza, pero
 * a un coordinador que entra a la vista docente no, y vería las de todos.
 */
export function useLessonPlanList(filters: LessonPlanFilters): PagedList<LessonPlan> {
  const key = JSON.stringify([
    filters.teacherId,
    filters.status,
    filters.periodId,
    filters.gradeId,
    filters.areaId,
  ]);
  return usePagedList<LessonPlan>(
    (page) => listLessonPlans({ ...filters, page, pageSize: LESSON_PLAN_PAGE_SIZE }),
    key,
  );
}
