'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { ApiError } from '@/shared/api';

import { answerActivityGame, nextActivityGameStep, startActivityGame } from '../api/activities';
import type { BestAttempt } from '../model/challenge';
import { answerBody, initialTrueOrMythState, trueOrMythReducer } from '../model/true-or-myth';

/** 409 de la API: la partida ya no existe, quedó obsoleta o el paso está fuera de orden. */
const CONFLICT_STATUS = 409;

interface UseTrueOrMythOptions {
  activityId: string;
  best: BestAttempt | null;
  /** La API registró avance (la partida terminó): el módulo vuelve a pedirse. */
  onProgress: () => void;
}

/**
 * ¿Verdad o mito? sobre la API. `trueOrMythReducer` decide las transiciones; aquí solo se hacen las
 * llamadas cuando la máquina entra en `starting`, `submitting` o `loadingNext`. Cada solicitud
 * (`fase:seq`) se envía una sola vez aunque el efecto corra dos veces (modo estricto), de modo que
 * una afirmación nunca se responde dos veces.
 */
export function useTrueOrMythGame({ activityId, best, onProgress }: UseTrueOrMythOptions) {
  const [state, dispatch] = useReducer(trueOrMythReducer, best, initialTrueOrMythState);
  const sentRef = useRef<string | null>(null);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onProgressRef.current = onProgress;
  });

  useEffect(() => {
    const { phase, seq } = state;
    if (phase !== 'starting' && phase !== 'submitting' && phase !== 'loadingNext') {
      return;
    }
    const key = `${phase}:${seq}`;
    if (sentRef.current === key) {
      return;
    }
    sentRef.current = key;

    const fail = (error: ApiError) =>
      error.statusCode === CONFLICT_STATUS && phase !== 'starting'
        ? dispatch({ type: 'conflict' })
        : dispatch({ type: 'failed', message: error.message });

    if (phase === 'starting') {
      void startActivityGame(activityId).then((result) =>
        result.ok ? dispatch({ type: 'step', step: result.data }) : fail(result.error),
      );
    } else if (phase === 'loadingNext') {
      void nextActivityGameStep(activityId).then((result) =>
        result.ok ? dispatch({ type: 'step', step: result.data }) : fail(result.error),
      );
    } else {
      const body = answerBody(state);
      if (!body) {
        return;
      }
      void answerActivityGame(activityId, body).then((result) => {
        if (!result.ok) {
          fail(result.error);
          return;
        }
        if (result.data.type !== 'verdad_o_mito') {
          dispatch({ type: 'failed', message: 'No pudimos leer la respuesta.' });
          return;
        }
        dispatch({ type: 'result', result: result.data });
        if (result.data.finished) {
          onProgressRef.current();
        }
      });
    }
  }, [state, activityId]);

  const start = useCallback(() => dispatch({ type: 'start' }), []);
  const retry = useCallback(() => dispatch({ type: 'retry' }), []);
  const choose = useCallback((value: boolean) => dispatch({ type: 'choose', value }), []);
  const timeout = useCallback(() => dispatch({ type: 'timeout' }), []);
  const advance = useCallback(() => dispatch({ type: 'advance' }), []);

  return { state, start, retry, choose, timeout, advance };
}
