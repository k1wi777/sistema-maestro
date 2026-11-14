import { BadRequestException, ConflictException } from '@nestjs/common';
import type { MatchAnswerBody, MatchAnswerResult, MatchConfig, MatchRound } from '@gns/shared';
import { StaleGameError } from './challenge-engine';
import { GAME_STATE_VERSION, type MatchGameState } from './game-state';
import { newToken, secureRandomInt, shuffled, type RandomInt } from './random';
import { isLate, matchPoints, scorePercentage, secondsBetween } from './scoring';

/** Entrega de una ronda: conceptos y datos mezclados, identificados solo por tokens. */
export function matchRound(state: MatchGameState, config: MatchConfig): MatchRound {
  const round = state.rounds[state.roundIndex];
  if (!round) {
    throw new StaleGameError();
  }
  const pairAt = (position: number) => round.pairs[position];
  return {
    round: state.roundIndex + 1,
    totalRounds: state.rounds.length,
    seconds: config.segundos_por_ronda,
    concepts: round.conceptOrder.map((position) => {
      const pair = pairAt(position);
      const source = pair ? config.pares[pair.index] : undefined;
      if (!pair || !source) {
        throw new StaleGameError();
      }
      return {
        token: pair.conceptToken,
        concepto: source.concepto,
        ...(source.emoji === undefined ? {} : { emoji: source.emoji }),
      };
    }),
    facts: round.factOrder.map((position) => {
      const pair = pairAt(position);
      const source = pair ? config.pares[pair.index] : undefined;
      if (!pair || !source) {
        throw new StaleGameError();
      }
      return { token: pair.factToken, dato: source.dato };
    }),
  };
}

export function startMatch(
  config: MatchConfig,
  activityUpdatedAt: Date,
  now: Date,
  random: RandomInt = secureRandomInt,
): { state: MatchGameState; round: MatchRound } {
  const needed = config.pares_por_ronda * config.rondas;
  const chosen = shuffled(
    config.pares.map((_pair, index) => index),
    random,
  ).slice(0, needed);
  const rounds = Array.from({ length: config.rondas }, (_unused, roundNumber) => {
    const indexes = chosen.slice(
      roundNumber * config.pares_por_ronda,
      (roundNumber + 1) * config.pares_por_ronda,
    );
    const positions = indexes.map((_index, position) => position);
    return {
      pairs: indexes.map((index) => ({
        index,
        conceptToken: newToken(),
        factToken: newToken(),
        connected: false,
        failed: false,
      })),
      conceptOrder: shuffled(positions, random),
      factOrder: shuffled(positions, random),
    };
  });
  const state: MatchGameState = {
    version: GAME_STATE_VERSION,
    kind: 'conecta',
    startedAt: now.toISOString(),
    activityUpdatedAt: activityUpdatedAt.toISOString(),
    rounds,
    roundIndex: 0,
    servedAt: now.toISOString(),
    roundOver: false,
    points: 0,
    streak: 0,
    firstAttempts: 0,
  };
  return { state, round: matchRound(state, config) };
}

export interface MatchOutcome {
  state: MatchGameState;
  /** Presente cuando la partida terminó con esta acción. */
  tally: { score: number; points: number } | null;
}

const isLastRound = (state: MatchGameState): boolean => state.roundIndex + 1 >= state.rounds.length;

function tallyOf(state: MatchGameState, config: MatchConfig): { score: number; points: number } {
  return {
    score: scorePercentage(state.firstAttempts, config.pares_por_ronda * config.rondas),
    points: state.points,
  };
}

export function answerMatch(
  state: MatchGameState,
  config: MatchConfig,
  body: MatchAnswerBody,
  now: Date,
): MatchOutcome & { response: Omit<MatchAnswerResult, 'result'> } {
  if (state.roundOver) {
    throw new ConflictException('La ronda ya terminó; pasa a la siguiente');
  }
  const round = state.rounds[state.roundIndex];
  if (!round) {
    throw new StaleGameError();
  }
  const pair = round.pairs.find((candidate) => candidate.conceptToken === body.conceptToken);
  if (!pair || !round.pairs.some((candidate) => candidate.factToken === body.factToken)) {
    throw new BadRequestException('Ese concepto o dato no está en la ronda en curso');
  }
  if (pair.connected) {
    throw new ConflictException('Ese concepto ya está conectado');
  }
  const elapsed = secondsBetween(new Date(state.servedAt), now);
  const connectedBefore = round.pairs.filter((candidate) => candidate.connected).length;

  let next: MatchGameState;
  let response: Omit<MatchAnswerResult, 'result'>;
  if (isLate(elapsed, config.segundos_por_ronda)) {
    // Fuera de tiempo no puntúa: la ronda se cierra y lo no conectado cuenta como fallo.
    next = { ...state, roundOver: true, streak: 0 };
    response = {
      type: 'conecta',
      correct: false,
      firstAttempt: false,
      pointsGained: 0,
      streak: 0,
      totalPoints: state.points,
      connected: connectedBefore,
      roundOver: true,
      finished: false,
    };
  } else if (pair.factToken === body.factToken) {
    const firstAttempt = !pair.failed;
    const streak = firstAttempt ? state.streak + 1 : 0;
    const gained = matchPoints(firstAttempt, elapsed, config.segundos_por_ronda, streak);
    const connected = connectedBefore + 1;
    const roundOver = connected === round.pairs.length;
    next = {
      ...state,
      rounds: state.rounds.map((candidate, index) =>
        index === state.roundIndex
          ? {
              ...candidate,
              pairs: candidate.pairs.map((item) =>
                item.conceptToken === pair.conceptToken ? { ...item, connected: true } : item,
              ),
            }
          : candidate,
      ),
      roundOver,
      points: state.points + gained,
      streak,
      firstAttempts: state.firstAttempts + (firstAttempt ? 1 : 0),
    };
    response = {
      type: 'conecta',
      correct: true,
      firstAttempt,
      pointsGained: gained,
      streak,
      totalPoints: next.points,
      connected,
      roundOver,
      finished: false,
    };
  } else {
    next = {
      ...state,
      rounds: state.rounds.map((candidate, index) =>
        index === state.roundIndex
          ? {
              ...candidate,
              pairs: candidate.pairs.map((item) =>
                item.conceptToken === pair.conceptToken ? { ...item, failed: true } : item,
              ),
            }
          : candidate,
      ),
      streak: 0,
    };
    response = {
      type: 'conecta',
      correct: false,
      firstAttempt: false,
      pointsGained: 0,
      streak: 0,
      totalPoints: state.points,
      connected: connectedBefore,
      roundOver: false,
      finished: false,
    };
  }
  // La última ronda cerrada termina la partida en la misma respuesta.
  const finished = next.roundOver && isLastRound(next);
  return {
    state: next,
    tally: finished ? tallyOf(next, config) : null,
    response: { ...response, finished },
  };
}

export function nextMatch(
  state: MatchGameState,
  config: MatchConfig,
  now: Date,
): MatchOutcome & { round: MatchRound | null } {
  let current = state;
  if (!current.roundOver) {
    const elapsed = secondsBetween(new Date(current.servedAt), now);
    if (!isLate(elapsed, config.segundos_por_ronda)) {
      throw new ConflictException('La ronda en curso aún no termina');
    }
    // El tiempo de la ronda se agotó sin responder: lo no conectado cuenta como fallo.
    current = { ...current, roundOver: true, streak: 0 };
  }
  if (isLastRound(current)) {
    return { state: current, tally: tallyOf(current, config), round: null };
  }
  const advanced: MatchGameState = {
    ...current,
    roundIndex: current.roundIndex + 1,
    servedAt: now.toISOString(),
    roundOver: false,
  };
  return { state: advanced, tally: null, round: matchRound(advanced, config) };
}
