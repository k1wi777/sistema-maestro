'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';

import { stampWheelCard } from '../api/activities';
import {
  initialWheelState,
  pickCard,
  spinRotation,
  wheelReducer,
  type WheelCardRef,
} from '../model/wheel';

interface UseWheelStampOptions {
  activityId: string;
  /** Sellos del avance al montar; después mandan los que devuelve la API. */
  stamps: string[];
  /** La API registró una respuesta: el módulo vuelve a pedirse con su avance. */
  onProgress: () => void;
}

/**
 * Ruleta y pasaporte sobre la API. La máquina de `wheelReducer` decide las transiciones; aquí solo
 * se elige la tarjeta al azar y se envía la respuesta cuando la máquina entra en `submitting`, una
 * sola vez por `seq` aunque el efecto corra dos veces (modo estricto).
 */
export function useWheelStamp({ activityId, stamps, onProgress }: UseWheelStampOptions) {
  const [state, dispatch] = useReducer(wheelReducer, stamps, initialWheelState);
  const sentRef = useRef(0);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onProgressRef.current = onProgress;
  });

  useEffect(() => {
    if (state.phase !== 'submitting' || sentRef.current === state.seq) {
      return;
    }
    sentRef.current = state.seq;
    if (!state.card || state.chosen === null) {
      return;
    }
    void stampWheelCard(activityId, {
      cardKey: state.card.key,
      optionIndex: state.chosen,
    }).then((result) => {
      if (!result.ok) {
        dispatch({ type: 'failed', message: result.error.message });
        return;
      }
      dispatch({ type: 'result', result: result.data });
      onProgressRef.current();
    });
  }, [state, activityId]);

  const spin = useCallback(
    (cards: readonly WheelCardRef[]) => {
      const index = pickCard(cards, state.stamps, Math.random);
      const card = cards[index];
      if (!card) {
        return;
      }
      dispatch({
        type: 'spin',
        index,
        key: card.clave,
        rotation: spinRotation(state.rotation, index, cards.length, Math.random),
      });
    },
    [state.stamps, state.rotation],
  );
  const spun = useCallback(() => dispatch({ type: 'spun' }), []);
  const choose = useCallback(
    (optionIndex: number) => dispatch({ type: 'choose', optionIndex }),
    [],
  );
  const retry = useCallback(() => dispatch({ type: 'retry' }), []);
  const review = useCallback((key: string) => dispatch({ type: 'review', key }), []);
  const closeReview = useCallback(() => dispatch({ type: 'closeReview' }), []);

  return { state, spin, spun, choose, retry, review, closeReview };
}
