'use client';

import {
  TeacherModuleState,
  type CertificateSummary,
  type TeacherModule,
  type ViewMark,
} from '@gns/shared';
import { useCallback, useState } from 'react';

import type { ApiError, ApiResult } from '@/shared/api';
import { useRemote, type Remote } from '@/shared/data';

import { listMyCertificates } from '../api/certificates';
import { getTrainingModule, markPresentationViewed, markVideoViewed } from '../api/route';

/** Un módulo de la ruta; se vuelve a pedir en silencio tras cada avance (`refresh`). */
export function useModuleData(moduleId: string): Remote<TeacherModule> {
  return useRemote(() => getTrainingModule(moduleId), `training-module:${moduleId}`);
}

/** Certificados del docente; solo el aviso de módulo terminado los pide. */
export function useMyCertificates(): Remote<CertificateSummary[]> {
  return useRemote(listMyCertificates, 'my-certificates');
}

type Marks = { video?: Date; presentation?: Date; completed?: boolean };

/**
 * Lo que devolvió la API en una marca se aplica primero (la pantalla responde de inmediato) y
 * después `refresh()` trae el estado calculado por la API; así lo que se pinta termina siendo
 * siempre lo que la API decide, sin recargar la página ni desmontar el video o el juego.
 */
export function useModuleView(module: TeacherModule, refresh: () => Promise<ApiError | null>) {
  const [marks, setMarks] = useState<Marks>({});

  const applyMark = useCallback(
    async (
      kind: 'video' | 'presentation',
      result: ApiResult<ViewMark>,
    ): Promise<ApiError | null> => {
      if (!result.ok) {
        return result.error;
      }
      const { viewedAt, completedAt } = result.data;
      setMarks((current) => ({
        ...current,
        [kind]: viewedAt,
        completed: current.completed || completedAt !== null,
      }));
      await refresh();
      return null;
    },
    [refresh],
  );

  const markVideo = useCallback(
    async () => applyMark('video', await markVideoViewed(module.id)),
    [applyMark, module.id],
  );
  const markPresentation = useCallback(
    async () => applyMark('presentation', await markPresentationViewed(module.id)),
    [applyMark, module.id],
  );

  /** Un juego terminó: si cerró el módulo se anuncia ya y luego se actualiza con la API. */
  const challengeFinished = useCallback(
    (completed: boolean) => {
      if (completed) {
        setMarks((current) => ({ ...current, completed: true }));
      }
      void refresh();
    },
    [refresh],
  );

  const shown: TeacherModule = {
    ...module,
    state: marks.completed ? TeacherModuleState.Done : module.state,
    progress: {
      ...module.progress,
      videoViewedAt: module.progress.videoViewedAt ?? marks.video ?? null,
      presentationViewedAt: module.progress.presentationViewedAt ?? marks.presentation ?? null,
    },
  };

  return { module: shown, markVideo, markPresentation, challengeFinished };
}
