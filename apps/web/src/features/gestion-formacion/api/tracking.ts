import { planTrackingSchema, type PlanTracking } from '@gns/shared';

import { api, callApi, parseResult, type ApiResult } from '@/shared/api';

export type { PlanTracking };

/** Avance de los docentes de un plan: una celda por docente y módulo publicado. */
export async function getPlanTracking(planId: string): Promise<ApiResult<PlanTracking>> {
  const result = await callApi(() =>
    api.GET('/training-tracking/plans/{planId}', { params: { path: { planId } } }),
  );
  return parseResult(result, planTrackingSchema);
}

/** CSV del avance de un plan; la API deja su propia fila de exportación en la bitácora. */
export async function exportPlanTracking(planId: string): Promise<ApiResult<Blob>> {
  const result = await callApi(() =>
    api.GET('/training-tracking/plans/{planId}/export', {
      params: { path: { planId } },
      parseAs: 'blob',
    }),
  );
  return result.ok ? { ok: true, data: result.data } : result;
}
