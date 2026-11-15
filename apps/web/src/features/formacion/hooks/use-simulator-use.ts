'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError } from '@/shared/api';

import { markSimulatorUsed } from '../api/activities';

interface UseFailure {
  activityId: string;
  error: ApiError;
}

/**
 * Registra el uso de un simulador sin enviar ningún dato: `markUsed` se llama con cada cambio de
 * una entrada y solo la primera vez por simulador en la visita llega a la API. Si falla, se vuelve
 * a permitir (con el siguiente cambio o con «Reintentar») y los cálculos del navegador no se ven
 * afectados.
 */
export function useSimulatorUse(onProgress: () => void) {
  const usedRef = useRef(new Set<string>());
  const onProgressRef = useRef(onProgress);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<UseFailure | null>(null);

  useEffect(() => {
    onProgressRef.current = onProgress;
  });

  const send = useCallback(async (activityId: string) => {
    usedRef.current.add(activityId);
    setBusy(true);
    setFailure(null);
    const result = await markSimulatorUsed(activityId);
    setBusy(false);
    if (result.ok) {
      onProgressRef.current();
    } else {
      usedRef.current.delete(activityId);
      setFailure({ activityId, error: result.error });
    }
  }, []);

  const markUsed = useCallback(
    (activityId: string) => {
      if (!usedRef.current.has(activityId)) {
        void send(activityId);
      }
    },
    [send],
  );

  const retry = useCallback(() => {
    if (failure) {
      void send(failure.activityId);
    }
  }, [failure, send]);

  return { markUsed, busy, failure, retry };
}
