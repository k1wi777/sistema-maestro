'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { ApiError } from '@/shared/api';

import { answerChallenge, nextChallengeStep, startChallenge } from '../api/challenge';
import {
  answerBody,
  challengeReducer,
  initialChallengeState,
  type BestAttempt,
  type ChallengeAnswer,
} from '../model/challenge';

/** 409 de la API: la partida ya no existe o quedó obsoleta (otra pestaña la reinició). */
const CONFLICT_STATUS = 409;

interface UseChallengeOptions {
  moduleId: string;
  best: BestAttempt | null;
  /** Se llama al terminar la partida; `completed` indica si con ella se terminó el módulo. */
  onFinished: (completed: boolean) => void;
}

/**
 * El Desafío GNS sobre la API. Toda la lógica de transiciones está en `challengeReducer`; aquí solo
 * se hacen las llamadas cuando la máquina entra en `starting`, `submitting` o `loadingNext`. Cada
 * entrada (`seq`) se envía una sola vez aunque el efecto se ejecute dos veces (modo estricto), de
 * modo que una pregunta nunca se responde dos veces.
 */
export function useChallenge({ moduleId, best, onFinished }: UseChallengeOptions) {
  const [state, dispatch] = useReducer(challengeReducer, best, initialChallengeState);
  const sentRef = useRef<string | null>(null);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
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
      void startChallenge(moduleId).then((result) =>
        result.ok ? dispatch({ type: 'step', step: result.data }) : fail(result.error),
      );
    } else if (phase === 'loadingNext') {
      void nextChallengeStep(moduleId).then((result) =>
        result.ok ? dispatch({ type: 'step', step: result.data }) : fail(result.error),
      );
    } else {
      const body = answerBody(state);
      if (!body) {
        return;
      }
      void answerChallenge(moduleId, body).then((result) => {
        if (!result.ok) {
          fail(result.error);
          return;
        }
        dispatch({ type: 'result', result: result.data });
        if (result.data.finished) {
          onFinishedRef.current(result.data.result?.completedAt != null);
        }
      });
    }
  }, [state, moduleId]);

  const start = useCallback(() => dispatch({ type: 'start' }), []);
  const retry = useCallback(() => dispatch({ type: 'retry' }), []);
  const choose = useCallback((answer: ChallengeAnswer) => dispatch({ type: 'choose', answer }), []);
  const place = useCallback((optionId: string) => dispatch({ type: 'place', optionId }), []);
  const unplace = useCallback((optionId: string) => dispatch({ type: 'unplace', optionId }), []);
  const unplaceLast = useCallback(() => dispatch({ type: 'unplaceLast' }), []);
  const confirmOrder = useCallback(() => dispatch({ type: 'confirmOrder' }), []);
  const timeout = useCallback(() => dispatch({ type: 'timeout' }), []);
  const advance = useCallback(() => dispatch({ type: 'advance' }), []);

  return {
    state,
    start,
    retry,
    choose,
    place,
    unplace,
    unplaceLast,
    confirmOrder,
    timeout,
    advance,
  };
}
