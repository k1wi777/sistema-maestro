'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { ApiError } from '@/shared/api';

import { answerActivityGame, nextActivityGameStep, startActivityGame } from '../api/activities';
import type { BestAttempt } from '../model/challenge';
import { initialMatchState, matchReducer } from '../model/match';

/** 409 de la API: la partida ya no existe, quedó obsoleta o el paso está fuera de orden. */
const CONFLICT_STATUS = 409;
/**
 * 400 al unir: los tokens son de otra partida. El cliente nunca envía un token que no sea de la
 * ronda en curso, así que solo ocurre si la partida se reinició en otra pestaña (la API valida los
 * tokens antes que la versión de la partida): se trata igual que un 409.
 */
const UNKNOWN_TOKEN_STATUS = 400;

interface UseMatchGameOptions {
  activityId: string;
  best: BestAttempt | null;
  /** La API registró avance (la partida terminó): el módulo vuelve a pedirse. */
  onProgress: () => void;
}

/**
 * Conecta sobre la API. `matchReducer` decide las transiciones; aquí solo se hacen las llamadas
 * cuando la máquina entra en `starting`, `loadingNext` o tiene una unión en vuelo. Cada solicitud
 * (`kind:seq`) se envía una sola vez aunque el efecto corra dos veces (modo estricto), de modo que
 * una unión nunca se envía dos veces.
 */
export function useMatchGame({ activityId, best, onProgress }: UseMatchGameOptions) {
  const [state, dispatch] = useReducer(matchReducer, best, initialMatchState);
  const sentRef = useRef<string | null>(null);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onProgressRef.current = onProgress;
  });

  useEffect(() => {
    const { phase, seq, pending } = state;
    const answering = pending !== null && (phase === 'playing' || phase === 'roundOver');
    const kind = phase === 'starting' ? 'start' : phase === 'loadingNext' ? 'next' : null;
    const action = kind ?? (answering ? 'answer' : null);
    if (!action) {
      return;
    }
    const key = `${action}:${seq}`;
    if (sentRef.current === key) {
      return;
    }
    sentRef.current = key;

    const gone = (error: ApiError) =>
      error.statusCode === CONFLICT_STATUS ||
      (action === 'answer' && error.statusCode === UNKNOWN_TOKEN_STATUS);
    const fail = (error: ApiError) =>
      gone(error) && action !== 'start'
        ? dispatch({ type: 'conflict' })
        : dispatch({ type: 'failed', message: error.message });

    if (action === 'start') {
      void startActivityGame(activityId).then((result) =>
        result.ok ? dispatch({ type: 'step', step: result.data }) : fail(result.error),
      );
    } else if (action === 'next') {
      void nextActivityGameStep(activityId).then((result) => {
        if (!result.ok) {
          fail(result.error);
          return;
        }
        dispatch({ type: 'step', step: result.data });
        if (result.data.finished) {
          onProgressRef.current();
        }
      });
    } else if (pending) {
      void answerActivityGame(activityId, pending).then((result) => {
        if (!result.ok) {
          fail(result.error);
          return;
        }
        if (result.data.type !== 'conecta') {
          dispatch({ type: 'failed', message: 'No pudimos leer la respuesta.' });
          return;
        }
        dispatch({ type: 'answered', result: result.data });
        if (result.data.finished) {
          onProgressRef.current();
        }
      });
    }
  }, [state, activityId]);

  const start = useCallback(() => dispatch({ type: 'start' }), []);
  const retry = useCallback(() => dispatch({ type: 'retry' }), []);
  const selectConcept = useCallback(
    (token: string) => dispatch({ type: 'selectConcept', token }),
    [],
  );
  const selectFact = useCallback((token: string) => dispatch({ type: 'selectFact', token }), []);
  const clearSelection = useCallback(() => dispatch({ type: 'clearSelection' }), []);
  const timeout = useCallback(() => dispatch({ type: 'timeout' }), []);
  const advance = useCallback(() => dispatch({ type: 'advance' }), []);

  return { state, start, retry, selectConcept, selectFact, clearSelection, timeout, advance };
}
