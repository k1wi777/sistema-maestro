'use client';

import type { PlanTracking, TrainingPlanSummary } from '@gns/shared';
import { useCallback, useState } from 'react';

import type { ApiError } from '@/shared/api';
import { useRemote, type Remote } from '@/shared/data';

import { listPlans } from '../api/plans';
import { exportPlanTracking, getPlanTracking } from '../api/tracking';

/** Planes de formación existentes, para el selector del avance. */
export function useTrackingPlans(): Remote<TrainingPlanSummary[]> {
  return useRemote(listPlans, 'gestion-formacion:tracking-plans');
}

/** Avance de los docentes en un plan: una celda por docente y módulo publicado. */
export function usePlanTracking(planId: string): Remote<PlanTracking> {
  return useRemote(() => getPlanTracking(planId), `gestion-formacion:tracking:${planId}`);
}

/** Nombre del archivo descargado: la API no expone el de `Content-Disposition` al cliente tipado. */
export const TRACKING_CSV_FILE_NAME = 'avance-formacion.csv';

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface TrackingExport {
  busy: boolean;
  error: ApiError | null;
  start: () => Promise<void>;
}

/** Descarga el CSV del plan; si falla, devuelve el error sin tocar lo que se ve en pantalla. */
export function useTrackingExport(planId: string | null): TrackingExport {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const start = useCallback(async () => {
    if (!planId) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await exportPlanTracking(planId);
    if (result.ok) {
      saveBlob(result.data, TRACKING_CSV_FILE_NAME);
    } else {
      setError(result.error);
    }
    setBusy(false);
  }, [planId]);

  return { busy, error, start };
}
