import {
  signedUrlSchema,
  teacherModuleSchema,
  teacherRouteSchema,
  viewMarkSchema,
  type ModuleFilePurpose,
  type SignedUrlResult,
  type TeacherModule,
  type TeacherRoute,
  type ViewMark,
} from '@gns/shared';

import { api, callApi, parseResult, type ApiResult } from '@/shared/api';

/** Ruta de formación del docente: planes del año vigente con sus módulos y su avance. */
export async function getTrainingRoute(): Promise<ApiResult<TeacherRoute>> {
  const result = await callApi(() => api.GET('/me/training/route'));
  return parseResult(result, teacherRouteSchema);
}

/** Un módulo de la ruta; uno que no está en ella responde 404. */
export async function getTrainingModule(moduleId: string): Promise<ApiResult<TeacherModule>> {
  const result = await callApi(() =>
    api.GET('/me/training/modules/{moduleId}', { params: { path: { moduleId } } }),
  );
  return parseResult(result, teacherModuleSchema);
}

/** Marca idempotente: el video se vio. */
export async function markVideoViewed(moduleId: string): Promise<ApiResult<ViewMark>> {
  const result = await callApi(() =>
    api.POST('/me/training/modules/{moduleId}/video-viewed', { params: { path: { moduleId } } }),
  );
  return parseResult(result, viewMarkSchema);
}

/** Marca idempotente: la presentación se revisó. */
export async function markPresentationViewed(moduleId: string): Promise<ApiResult<ViewMark>> {
  const result = await callApi(() =>
    api.POST('/me/training/modules/{moduleId}/presentation-viewed', {
      params: { path: { moduleId } },
    }),
  );
  return parseResult(result, viewMarkSchema);
}

/** URL firmada y con caducidad del video o la presentación en archivo. */
export async function getModuleFileUrl(
  moduleId: string,
  purpose: ModuleFilePurpose,
): Promise<ApiResult<SignedUrlResult>> {
  const result = await callApi(() =>
    api.POST('/me/training/modules/{moduleId}/files/{purpose}/url', {
      params: { path: { moduleId, purpose } },
    }),
  );
  return parseResult(result, signedUrlSchema);
}
