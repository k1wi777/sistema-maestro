import type {
  ChallengeAnswerBody,
  ChallengeAnswerResult,
  ChallengeStep,
  GameResult,
} from '@gns/shared';
import { ChallengeQuestionType } from '@gns/shared';

/** Respuesta ya decidida de una pregunta; `null` en el cuerpo de la API es tiempo agotado. */
export type ChallengeAnswer = NonNullable<ChallengeAnswerBody['answer']>;

export type ChallengePhase =
  | 'lobby'
  | 'starting'
  | 'question'
  | 'submitting'
  | 'answered'
  | 'loadingNext'
  | 'finished'
  | 'lost'
  | 'error';

/** Qué se repite al pulsar «Reintentar» tras un fallo de red. */
export type ChallengeRetry = 'start' | 'answer' | 'next';

export interface BestAttempt {
  score: number;
  points: number;
}

export interface ChallengeState {
  phase: ChallengePhase;
  step: ChallengeStep | null;
  /** Orden elegido en una pregunta de orden (ids de opción, en el orden en que se colocaron). */
  placed: string[];
  /** Lo que se envió; `null` si todavía no hay respuesta o se agotó el tiempo. */
  chosen: ChallengeAnswer | null;
  result: ChallengeAnswerResult | null;
  /** Resultado de la partida terminada. */
  final: GameResult | null;
  /** Mejor resultado conocido; se conserva si la partida se pierde. */
  best: BestAttempt | null;
  points: number;
  streak: number;
  errorMessage: string | null;
  retry: ChallengeRetry | null;
  /** Cuenta de solicitudes: distingue dos envíos seguidos de la misma pregunta (efectos del hook). */
  seq: number;
}

export type ChallengeEvent =
  | { type: 'start' }
  | { type: 'step'; step: ChallengeStep }
  | { type: 'choose'; answer: ChallengeAnswer }
  | { type: 'place'; optionId: string }
  | { type: 'unplace'; optionId: string }
  | { type: 'unplaceLast' }
  | { type: 'confirmOrder' }
  | { type: 'timeout' }
  | { type: 'result'; result: ChallengeAnswerResult }
  | { type: 'advance' }
  | { type: 'conflict' }
  | { type: 'failed'; message: string }
  | { type: 'retry' };

export function initialChallengeState(best: BestAttempt | null): ChallengeState {
  return {
    phase: 'lobby',
    step: null,
    placed: [],
    chosen: null,
    result: null,
    final: null,
    best,
    points: 0,
    streak: 0,
    errorMessage: null,
    retry: null,
    seq: 0,
  };
}

const FINISHED_WITHOUT_RESULT =
  'La partida terminó, pero no recibimos el resultado. Inténtalo de nuevo.';

function matchesQuestion(step: ChallengeStep, answer: ChallengeAnswer): boolean {
  const { question } = step;
  if (question.type === ChallengeQuestionType.TrueFalse) {
    return 'value' in answer;
  }
  if (question.type === ChallengeQuestionType.MultipleChoice) {
    return 'optionId' in answer && (question.options ?? []).some((o) => o.id === answer.optionId);
  }
  return 'optionIds' in answer;
}

function submitting(state: ChallengeState, chosen: ChallengeAnswer | null): ChallengeState {
  return { ...state, phase: 'submitting', chosen, seq: state.seq + 1, errorMessage: null };
}

/**
 * Máquina del Desafío GNS: `lobby → starting → question → submitting → answered → (loadingNext →
 * question | finished)`, más `lost` (la API ya no tiene la partida) y `error` (fallo de red).
 * Solo es transiciones: no calcula si una respuesta es correcta, eso lo dice la API. Garantiza una
 * sola respuesta por pregunta (cualquier evento de elección fuera de `question` se ignora) y que
 * el tiempo agotado se envía una sola vez.
 */
export function challengeReducer(state: ChallengeState, event: ChallengeEvent): ChallengeState {
  switch (event.type) {
    case 'start': {
      if (
        state.phase !== 'lobby' &&
        state.phase !== 'finished' &&
        state.phase !== 'lost' &&
        state.phase !== 'error'
      ) {
        return state;
      }
      return {
        ...initialChallengeState(state.best),
        phase: 'starting',
        seq: state.seq + 1,
        retry: null,
      };
    }
    case 'step': {
      if (state.phase !== 'starting' && state.phase !== 'loadingNext') {
        return state;
      }
      return {
        ...state,
        phase: 'question',
        step: event.step,
        placed: [],
        chosen: null,
        result: null,
        errorMessage: null,
        retry: null,
      };
    }
    case 'choose': {
      if (state.phase !== 'question' || !state.step || !matchesQuestion(state.step, event.answer)) {
        return state;
      }
      if (state.step.question.type === ChallengeQuestionType.Ordering) {
        return state;
      }
      return submitting(state, event.answer);
    }
    case 'place': {
      if (state.phase !== 'question' || !state.step) {
        return state;
      }
      const { question } = state.step;
      const exists = (question.options ?? []).some((option) => option.id === event.optionId);
      if (
        question.type !== ChallengeQuestionType.Ordering ||
        !exists ||
        state.placed.includes(event.optionId)
      ) {
        return state;
      }
      return { ...state, placed: [...state.placed, event.optionId] };
    }
    case 'unplace': {
      if (state.phase !== 'question' || !state.placed.includes(event.optionId)) {
        return state;
      }
      return { ...state, placed: state.placed.filter((id) => id !== event.optionId) };
    }
    case 'unplaceLast': {
      if (state.phase !== 'question' || state.placed.length === 0) {
        return state;
      }
      return { ...state, placed: state.placed.slice(0, -1) };
    }
    case 'confirmOrder': {
      if (state.phase !== 'question' || !state.step) {
        return state;
      }
      const { question } = state.step;
      const total = (question.options ?? []).length;
      if (question.type !== ChallengeQuestionType.Ordering || state.placed.length !== total) {
        return state;
      }
      return submitting(state, { optionIds: state.placed });
    }
    case 'timeout': {
      // El tiempo agotado solo vale mientras la pregunta sigue abierta: una vez enviada, no se repite.
      return state.phase === 'question' ? submitting(state, null) : state;
    }
    case 'result': {
      if (state.phase !== 'submitting') {
        return state;
      }
      return {
        ...state,
        phase: 'answered',
        result: event.result,
        points: event.result.totalPoints,
        streak: event.result.streak,
      };
    }
    case 'advance': {
      if (state.phase !== 'answered' || !state.result) {
        return state;
      }
      if (!state.result.finished) {
        return { ...state, phase: 'loadingNext', seq: state.seq + 1 };
      }
      const final = state.result.result;
      if (!final) {
        return {
          ...state,
          phase: 'error',
          errorMessage: FINISHED_WITHOUT_RESULT,
          retry: 'start',
        };
      }
      return {
        ...state,
        phase: 'finished',
        final,
        best: { score: final.bestScore, points: final.bestPoints },
      };
    }
    case 'conflict': {
      // La API ya no tiene la partida: se explica y se ofrece empezar otra, con el mejor resultado.
      if (state.phase === 'lobby' || state.phase === 'finished') {
        return state;
      }
      return { ...state, phase: 'lost', retry: null, errorMessage: null };
    }
    case 'failed': {
      const retry: ChallengeRetry | null =
        state.phase === 'starting'
          ? 'start'
          : state.phase === 'submitting'
            ? 'answer'
            : state.phase === 'loadingNext'
              ? 'next'
              : null;
      if (!retry) {
        return state;
      }
      return { ...state, phase: 'error', errorMessage: event.message, retry };
    }
    case 'retry': {
      if (state.phase !== 'error' || !state.retry) {
        return state;
      }
      if (state.retry === 'start') {
        return { ...state, phase: 'starting', seq: state.seq + 1, errorMessage: null, retry: null };
      }
      if (state.retry === 'answer') {
        return {
          ...state,
          phase: 'submitting',
          seq: state.seq + 1,
          errorMessage: null,
          retry: null,
        };
      }
      return {
        ...state,
        phase: 'loadingNext',
        seq: state.seq + 1,
        errorMessage: null,
        retry: null,
      };
    }
  }
}

/** Cuerpo para la API de la respuesta en vuelo. */
export function answerBody(state: ChallengeState): ChallengeAnswerBody | null {
  if (!state.step) {
    return null;
  }
  return { questionId: state.step.question.id, answer: state.chosen };
}
