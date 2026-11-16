import {
  lessonPlanComplianceSchema,
  type LessonPlanCompliance,
  type LessonPlanComplianceQuery,
} from '@gns/shared';

import { api, callApi, parseResult, type ApiResult } from '@/shared/api';

/** Cumplimiento de entregas del año vigente (opcionalmente de un periodo o de un docente). */
export async function getCompliance(
  query: LessonPlanComplianceQuery,
): Promise<ApiResult<LessonPlanCompliance>> {
  const result = await callApi(() => api.GET('/lesson-plan-compliance', { params: { query } }));
  return parseResult(result, lessonPlanComplianceSchema);
}
