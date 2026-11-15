'use client';

import type { CertificateSummary, TeacherRoute } from '@gns/shared';

import type { ApiResult } from '@/shared/api';
import { useRemote, type Remote } from '@/shared/data';

import { listMyCertificates } from '../api/certificates';
import { getTrainingRoute } from '../api/route';

/** Ruta de formación del docente con su avance. */
export function useTrainingRoute(): Remote<TeacherRoute> {
  return useRemote(getTrainingRoute, 'training-route');
}

export interface TrainingProgressData {
  route: TeacherRoute;
  certificates: CertificateSummary[];
}

async function loadProgress(): Promise<ApiResult<TrainingProgressData>> {
  const [route, certificates] = await Promise.all([getTrainingRoute(), listMyCertificates()]);
  if (!route.ok) {
    return route;
  }
  if (!certificates.ok) {
    return certificates;
  }
  return { ok: true, data: { route: route.data, certificates: certificates.data } };
}

/** La ruta y los certificados juntos: la página de progreso empareja módulo y certificado. */
export function useTrainingProgress(): Remote<TrainingProgressData> {
  return useRemote(loadProgress, 'training-progress');
}
