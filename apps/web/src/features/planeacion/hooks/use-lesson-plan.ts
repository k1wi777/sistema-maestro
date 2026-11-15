import type { LessonPlan, Review } from '@gns/shared';

import type { ApiResult } from '@/shared/api';

import { getLessonPlan, listLessonPlanReviews } from '../api/lesson-plans';
import { useRemote, type RemoteState } from './use-remote';

export interface LessonPlanWithReviews {
  plan: LessonPlan;
  reviews: Review[];
}

async function loadLessonPlan(id: string): Promise<ApiResult<LessonPlanWithReviews>> {
  const [plan, reviews] = await Promise.all([getLessonPlan(id), listLessonPlanReviews(id)]);
  if (!plan.ok) {
    return plan;
  }
  // Sin historial la planeación se edita igual: solo faltarían la observación y los ajustes.
  return { ok: true, data: { plan: plan.data, reviews: reviews.ok ? reviews.data : [] } };
}

/** Una planeación con su historial de revisión de coordinación. */
export function useLessonPlan(id: string): {
  state: RemoteState<LessonPlanWithReviews>;
  reload: () => void;
} {
  return useRemote(() => loadLessonPlan(id), `lesson-plan:${id}`);
}
