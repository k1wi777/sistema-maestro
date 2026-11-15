import type {
  ActivityGameStep,
  GameResult,
  TrueOrMythAnswerBody,
  TrueOrMythAnswerResult,
} from '@gns/shared';

import type { BestAttempt } from './challenge';

export type TrueOrMythPhase =
  | 'lobby'
  | 'starting'
  | 'statement'
  | 'submitting'
  | 'answered'
  | 'loadingNext'
  | 'finished'
  | 'lost'
  | 'error';

/** Qué se repite al pulsar «Reintentar» tras un fallo de red. */
export type TrueOrMythRetry = 'start' | 'answer' | 'next';

/** Afirmación en curso, sin su veredicto: lo calcula la API al responder. */
export interface Statement {
  position: number;
  text: string;
  seconds: number;
}

export interface TrueOrMythState {
  phase: TrueOrMythPhase;
  statement: Statement | null;
  total: number;
  lives: number;
  /** Lo que se envió: `true` verdad, `false` mito, `null` tiempo agotado (o aún sin respuesta). */
  chosen: boolean | null;
  result: TrueOrMythAnswerResult | null;
  final: GameResult | null;
  best: BestAttempt | null;
  points: number;
  streak: number;
  errorMessage: string | null;
  retry: TrueOrMythRetry | null;
  /** Cuenta de solicitudes: distingue dos envíos seguidos (efectos del hook, modo estricto). */
  seq: number;
}

export type TrueOrMythEvent =
  | { type: 'start' }
  | { type: 'step'; step: ActivityGameStep }
  | { type: 'choose'; value: boolean }
  | { type: 'timeout' }
  | { type: 'result'; result: TrueOrMythAnswerResult }
  | { type: 'advance' }
  | { type: 'conflict' }
  | { type: 'failed'; message: string }
  | { type: 'retry' };

export function initialTrueOrMythState(best: BestAttempt | null): TrueOrMythState {
  return {
    phase: 'lobby',
    statement: null,
    total: 0,
    lives: 0,
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
const UNEXPECTED_STEP = 'No pudimos cargar la actividad. Inténtalo de nuevo.';

function submitting(state: TrueOrMythState, chosen: boolean | null): TrueOrMythState {
  return { ...state, phase: 'submitting', chosen, seq: state.seq + 1, errorMessage: null };
}

function applyStep(state: TrueOrMythState, step: ActivityGameStep): TrueOrMythState {
  if (step.type !== 'verdad_o_mito' || step.finished || !step.statement) {
    return { ...state, phase: 'error', errorMessage: UNEXPECTED_STEP, retry: 'start' };
  }
  return {
    ...state,
    phase: 'statement',
    statement: step.statement,
    total: step.total,
    lives: step.lives,
    chosen: null,
    result: null,
    errorMessage: null,
    retry: null,
  };
}

/**
 * Máquina de ¿Verdad o mito?: `lobby → starting → statement → submitting → answered → (loadingNext
 * → statement | finished)`, más `lost` (la API ya no tiene la partida) y `error` (fallo de red).
 * Solo son transiciones: si una respuesta es correcta lo dice la API. Garantiza una sola respuesta
 * por afirmación (cualquier elección fuera de `statement` se ignora) y que el tiempo agotado se
 * envíe una sola vez.
 */
export function trueOrMythReducer(state: TrueOrMythState, event: TrueOrMythEvent): TrueOrMythState {
  switch (event.type) {
    case 'start': {
      if (!['lobby', 'finished', 'lost', 'error'].includes(state.phase)) {
        return state;
      }
      return { ...initialTrueOrMythState(state.best), phase: 'starting', seq: state.seq + 1 };
    }
    case 'step':
      return state.phase === 'starting' || state.phase === 'loadingNext'
        ? applyStep(state, event.step)
        : state;
    case 'choose':
      return state.phase === 'statement' ? submitting(state, event.value) : state;
    case 'timeout':
      return state.phase === 'statement' ? submitting(state, null) : state;
    case 'result': {
      if (state.phase !== 'submitting') {
        return state;
      }
      return {
        ...state,
        phase: 'answered',
        result: event.result,
        lives: event.result.lives,
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
        return { ...state, phase: 'error', errorMessage: FINISHED_WITHOUT_RESULT, retry: 'start' };
      }
      return {
        ...state,
        phase: 'finished',
        final,
        best: { score: final.bestScore, points: final.bestPoints },
      };
    }
    case 'conflict':
      return state.phase === 'lobby' || state.phase === 'finished'
        ? state
        : { ...state, phase: 'lost', retry: null, errorMessage: null };
    case 'failed': {
      const retry: TrueOrMythRetry | null =
        state.phase === 'starting'
          ? 'start'
          : state.phase === 'submitting'
            ? 'answer'
            : state.phase === 'loadingNext'
              ? 'next'
              : null;
      return retry ? { ...state, phase: 'error', errorMessage: event.message, retry } : state;
    }
    case 'retry': {
      if (state.phase !== 'error' || !state.retry) {
        return state;
      }
      const base = { ...state, seq: state.seq + 1, errorMessage: null, retry: null };
      return {
        ...base,
        phase:
          state.retry === 'start'
            ? 'starting'
            : state.retry === 'answer'
              ? 'submitting'
              : 'loadingNext',
      };
    }
  }
}

/** Cuerpo para la API de la respuesta en vuelo. */
export function answerBody(state: TrueOrMythState): TrueOrMythAnswerBody | null {
  return state.statement ? { position: state.statement.position, value: state.chosen } : null;
}

export type TrueOrMythKeyAction = { type: 'choose'; value: boolean } | { type: 'advance' };

/**
 * Teclas del juego: ← es Mito y → es Verdad mientras hay una afirmación abierta; Enter pasa a la
 * siguiente. No actúa con el foco en un campo de texto ni con teclas modificadoras.
 */
export function trueOrMythKey(input: {
  key: string;
  phase: TrueOrMythPhase;
  inField?: boolean;
  modified?: boolean;
}): TrueOrMythKeyAction | null {
  if (input.inField || input.modified) {
    return null;
  }
  if (input.phase === 'statement') {
    if (input.key === 'ArrowLeft') {
      return { type: 'choose', value: false };
    }
    return input.key === 'ArrowRight' ? { type: 'choose', value: true } : null;
  }
  return input.phase === 'answered' && input.key === 'Enter' ? { type: 'advance' } : null;
}

/** Texto que lee el lector de pantalla cuando cambia la fase (región `aria-live`). */
export function trueOrMythAnnouncement(state: TrueOrMythState): string {
  switch (state.phase) {
    case 'statement':
      return state.statement
        ? `Afirmación ${state.statement.position} de ${state.total}. ${state.statement.text}`
        : '';
    case 'answered': {
      const { result } = state;
      if (!result) {
        return '';
      }
      const verdict = result.timedOut
        ? 'Se acabó el tiempo.'
        : result.correct
          ? 'Correcto.'
          : 'Incorrecto.';
      const lives = result.lives === 1 ? '1 vida' : `${result.lives} vidas`;
      const broke = result.lives <= 0 ? ' Te quedaste sin vidas.' : '';
      return `${verdict} Era ${result.isTrue ? 'verdad' : 'mito'}. ${result.explanation} Te quedan ${lives}.${broke}`;
    }
    case 'finished':
      return state.final
        ? `Partida terminada: ${state.final.score} por ciento. ${
            state.final.passed ? 'Aprobaste.' : 'No alcanzaste el porcentaje necesario.'
          }`
        : '';
    case 'lost':
      return 'Esta partida ya no está disponible.';
    default:
      return '';
  }
}
