import {
  GAME_LATENCY_MARGIN_SECONDS,
  type ActivityGameStep,
  type GameResult,
  type MatchAnswerBody,
  type MatchAnswerResult,
  type MatchRound,
} from '@gns/shared';

import type { BestAttempt } from './challenge';

export type MatchPhase =
  'lobby' | 'starting' | 'playing' | 'roundOver' | 'loadingNext' | 'finished' | 'lost' | 'error';

/** Cómo terminó la ronda: todas conectadas, tiempo agotado en el reloj local o cerrada por la API. */
export type MatchOverBy = 'complete' | 'time' | 'late';

/** Último hecho de la ronda, para anunciarlo a lectores de pantalla. */
export type MatchNotice = 'hit' | 'miss' | 'complete' | 'time' | 'late';

/** Qué se repite al pulsar «Reintentar» tras un fallo de red. */
export type MatchRetry = 'start' | 'answer' | 'next';

export interface MatchState {
  phase: MatchPhase;
  round: MatchRound | null;
  /** Tokens ya conectados de la ronda en curso. */
  connectedConcepts: string[];
  connectedFacts: string[];
  concept: string | null;
  fact: string | null;
  /** Unión enviada a la API que aún no responde: solo puede haber una. */
  pending: MatchAnswerBody | null;
  points: number;
  streak: number;
  overBy: MatchOverBy | null;
  /** La API dio la partida por terminada; el resultado se muestra con «Ver resultado». */
  ended: boolean;
  final: GameResult | null;
  best: BestAttempt | null;
  notice: MatchNotice | null;
  /** Pareja del último intento fallido (hasta la siguiente selección): da la señal visual del error. */
  lastMiss: { conceptToken: string; factToken: string } | null;
  /** Puntos que ganó la última unión acertada (0 si falló). */
  gain: number;
  /** Cuenta de avisos: cada uno se anuncia aunque el texto sea el mismo que el anterior. */
  noticeSeq: number;
  errorMessage: string | null;
  retry: MatchRetry | null;
  /** Cuenta de solicitudes: distingue dos envíos seguidos (efectos del hook, modo estricto). */
  seq: number;
}

export type MatchEvent =
  | { type: 'start' }
  | { type: 'step'; step: ActivityGameStep }
  | { type: 'selectConcept'; token: string }
  | { type: 'selectFact'; token: string }
  | { type: 'clearSelection' }
  | { type: 'answered'; result: MatchAnswerResult }
  | { type: 'timeout' }
  | { type: 'advance' }
  | { type: 'conflict' }
  | { type: 'failed'; message: string }
  | { type: 'retry' };

export function initialMatchState(best: BestAttempt | null): MatchState {
  return {
    phase: 'lobby',
    round: null,
    connectedConcepts: [],
    connectedFacts: [],
    concept: null,
    fact: null,
    pending: null,
    points: 0,
    streak: 0,
    overBy: null,
    ended: false,
    final: null,
    best,
    notice: null,
    lastMiss: null,
    gain: 0,
    noticeSeq: 0,
    errorMessage: null,
    retry: null,
    seq: 0,
  };
}

const FINISHED_WITHOUT_RESULT =
  'La partida terminó, pero no recibimos el resultado. Inténtalo de nuevo.';
const UNEXPECTED_STEP = 'No pudimos cargar la actividad. Inténtalo de nuevo.';

/**
 * Milisegundos que hay que esperar antes de pedir el paso siguiente. Si el tiempo se agotó en el
 * reloj local, la API aún puede considerar la ronda abierta hasta `segundos + margen`: se espera ese
 * margen más medio segundo (el cero visual ya va por detrás del reloj del servidor) para que
 * `game/next` nunca llegue antes. Con la ronda completa o cerrada por la API, no hay espera.
 */
export function advanceDelayMs(overBy: MatchOverBy | null): number {
  return overBy === 'time' ? GAME_LATENCY_MARGIN_SECONDS * 1000 + 500 : 0;
}

const withNotice = (state: MatchState, notice: MatchNotice): MatchState => ({
  ...state,
  notice,
  noticeSeq: state.noticeSeq + 1,
});

function isActive(state: MatchState): boolean {
  return state.phase === 'playing' && state.pending === null;
}

/** Con concepto y dato elegidos, la unión se envía: queda en vuelo y no admite más selecciones. */
function withSelection(state: MatchState, concept: string | null, fact: string | null): MatchState {
  if (concept !== null && fact !== null) {
    return {
      ...state,
      concept,
      fact,
      pending: { conceptToken: concept, factToken: fact },
      lastMiss: null,
      seq: state.seq + 1,
    };
  }
  return { ...state, concept, fact, lastMiss: null };
}

function applyStep(state: MatchState, step: ActivityGameStep): MatchState {
  if (step.type !== 'conecta') {
    return { ...state, phase: 'error', errorMessage: UNEXPECTED_STEP, retry: 'start' };
  }
  if (step.finished) {
    if (!step.result) {
      return { ...state, phase: 'error', errorMessage: FINISHED_WITHOUT_RESULT, retry: 'start' };
    }
    return {
      ...state,
      phase: 'finished',
      final: step.result,
      best: { score: step.result.bestScore, points: step.result.bestPoints },
      errorMessage: null,
      retry: null,
    };
  }
  if (!step.round) {
    return { ...state, phase: 'error', errorMessage: UNEXPECTED_STEP, retry: 'start' };
  }
  return {
    ...state,
    phase: 'playing',
    round: step.round,
    connectedConcepts: [],
    connectedFacts: [],
    concept: null,
    fact: null,
    pending: null,
    overBy: null,
    notice: null,
    lastMiss: null,
    gain: 0,
    errorMessage: null,
    retry: null,
  };
}

/**
 * Máquina de Conecta: `lobby → starting → playing → roundOver → loadingNext → playing… → finished`,
 * más `lost` (la API ya no tiene la partida) y `error` (fallo de red, con reintento). Solo son
 * transiciones: si una unión es correcta lo dice la API. Garantiza una sola unión en vuelo (las
 * selecciones se ignoran mientras hay una), que nunca se envíe un concepto o dato ya conectado y
 * que una ronda cerrada ignore toda unión.
 */
export function matchReducer(state: MatchState, event: MatchEvent): MatchState {
  switch (event.type) {
    case 'start': {
      if (!['lobby', 'finished', 'lost', 'error'].includes(state.phase)) {
        return state;
      }
      return {
        ...initialMatchState(state.best),
        phase: 'starting',
        seq: state.seq + 1,
        noticeSeq: state.noticeSeq,
      };
    }
    case 'step': {
      if (state.phase !== 'starting' && state.phase !== 'loadingNext') {
        return state;
      }
      return applyStep(state, event.step);
    }
    case 'selectConcept': {
      const exists = state.round?.concepts.some((item) => item.token === event.token) ?? false;
      if (!isActive(state) || !exists || state.connectedConcepts.includes(event.token)) {
        return state;
      }
      return withSelection(state, state.concept === event.token ? null : event.token, state.fact);
    }
    case 'selectFact': {
      const exists = state.round?.facts.some((item) => item.token === event.token) ?? false;
      if (!isActive(state) || !exists || state.connectedFacts.includes(event.token)) {
        return state;
      }
      return withSelection(state, state.concept, state.fact === event.token ? null : event.token);
    }
    case 'clearSelection':
      return isActive(state) && (state.concept !== null || state.fact !== null)
        ? { ...state, concept: null, fact: null }
        : state;
    case 'answered': {
      const open = state.phase === 'playing' || state.phase === 'roundOver';
      if (!open || !state.pending) {
        return state;
      }
      const { result } = event;
      const pending = state.pending;
      const next: MatchState = {
        ...state,
        pending: null,
        concept: null,
        fact: null,
        points: result.totalPoints,
        gain: result.correct ? Math.max(0, result.totalPoints - state.points) : 0,
        lastMiss: result.correct
          ? null
          : { conceptToken: pending.conceptToken, factToken: pending.factToken },
        streak: result.streak,
        connectedConcepts: result.correct
          ? [...state.connectedConcepts, pending.conceptToken]
          : state.connectedConcepts,
        connectedFacts: result.correct
          ? [...state.connectedFacts, pending.factToken]
          : state.connectedFacts,
        ended: result.finished,
        final: result.result ?? null,
        best: result.result
          ? { score: result.result.bestScore, points: result.result.bestPoints }
          : state.best,
      };
      if (result.roundOver) {
        const overBy: MatchOverBy = result.correct ? 'complete' : 'late';
        return withNotice({ ...next, phase: 'roundOver', overBy }, overBy);
      }
      return withNotice(next, result.correct ? 'hit' : 'miss');
    }
    case 'timeout': {
      // El tiempo solo cierra la ronda mientras sigue abierta; una unión en vuelo aún se resuelve.
      if (state.phase !== 'playing') {
        return state;
      }
      return withNotice(
        { ...state, phase: 'roundOver', overBy: 'time', concept: null, fact: null },
        'time',
      );
    }
    case 'advance': {
      if (state.phase !== 'roundOver' || state.pending) {
        return state;
      }
      if (state.ended) {
        if (!state.final) {
          return {
            ...state,
            phase: 'error',
            errorMessage: FINISHED_WITHOUT_RESULT,
            retry: 'start',
          };
        }
        return { ...state, phase: 'finished' };
      }
      return { ...state, phase: 'loadingNext', seq: state.seq + 1 };
    }
    case 'conflict': {
      if (state.phase === 'lobby' || state.phase === 'finished') {
        return state;
      }
      return { ...state, phase: 'lost', pending: null, retry: null, errorMessage: null };
    }
    case 'failed': {
      let retry: MatchRetry | null = null;
      if (state.phase === 'starting') {
        retry = 'start';
      } else if (state.phase === 'loadingNext') {
        retry = 'next';
      } else if ((state.phase === 'playing' || state.phase === 'roundOver') && state.pending) {
        retry = 'answer';
      }
      return retry ? { ...state, phase: 'error', errorMessage: event.message, retry } : state;
    }
    case 'retry': {
      if (state.phase !== 'error' || !state.retry) {
        return state;
      }
      const base = { ...state, errorMessage: null, retry: null, seq: state.seq + 1 };
      if (state.retry === 'start') {
        return { ...base, phase: 'starting' };
      }
      if (state.retry === 'next') {
        return { ...base, phase: 'loadingNext' };
      }
      return { ...base, phase: state.overBy === null ? 'playing' : 'roundOver' };
    }
  }
}

/** Texto que lee el lector de pantalla tras cada hecho de la partida (región `aria-live`). */
export function matchAnnouncement(state: MatchState): string {
  switch (state.phase) {
    case 'playing':
      if (state.notice === 'hit') {
        return `Pareja conectada. ${state.points} puntos, racha de ${state.streak}.`;
      }
      if (state.notice === 'miss') {
        return 'No es su pareja.';
      }
      return state.round ? `Ronda ${state.round.round} de ${state.round.totalRounds}.` : '';
    case 'roundOver':
      if (state.overBy === 'complete') {
        return 'Ronda completa. Todas las parejas conectadas.';
      }
      return 'Se acabó el tiempo de la ronda.';
    case 'finished':
      return state.final
        ? `Partida terminada: ${state.final.score} por ciento. ${
            state.final.passed ? 'Aprobaste.' : 'No alcanzaste el porcentaje necesario.'
          }`
        : '';
    case 'lost':
      return 'Esta partida ya no está disponible.';
    case 'error':
      return `No pudimos continuar. ${state.errorMessage ?? ''}`.trim();
    default:
      return '';
  }
}
