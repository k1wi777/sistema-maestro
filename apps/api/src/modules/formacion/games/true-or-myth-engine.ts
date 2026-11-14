import { ConflictException } from '@nestjs/common';
import type { TrueOrMythAnswerBody, TrueOrMythAnswerResult, TrueOrMythConfig } from '@gns/shared';
import { StaleGameError } from './challenge-engine';
import { GAME_STATE_VERSION, type TrueOrMythGameState } from './game-state';
import { secureRandomInt, shuffled, type RandomInt } from './random';
import { isLate, scorePercentage, secondsBetween, trueOrMythPoints } from './scoring';

export interface StatementStep {
  total: number;
  lives: number;
  statement: { position: number; text: string; seconds: number };
}

/** Afirmación en curso, sin su veredicto ni su explicación. */
export function statementStep(state: TrueOrMythGameState, config: TrueOrMythConfig): StatementStep {
  const index = state.statementIndexes[state.position];
  const source = index === undefined ? undefined : config.afirmaciones[index];
  if (!source) {
    throw new StaleGameError();
  }
  return {
    total: state.statementIndexes.length,
    lives: state.lives,
    statement: {
      position: state.position + 1,
      text: source.texto,
      seconds: config.segundos_por_afirmacion,
    },
  };
}

export function startTrueOrMyth(
  config: TrueOrMythConfig,
  activityUpdatedAt: Date,
  now: Date,
  random: RandomInt = secureRandomInt,
): { state: TrueOrMythGameState; step: StatementStep } {
  const statementIndexes = shuffled(
    config.afirmaciones.map((_statement, index) => index),
    random,
  ).slice(0, config.por_partida);
  const state: TrueOrMythGameState = {
    version: GAME_STATE_VERSION,
    kind: 'verdad_o_mito',
    startedAt: now.toISOString(),
    activityUpdatedAt: activityUpdatedAt.toISOString(),
    statementIndexes,
    position: 0,
    servedAt: now.toISOString(),
    answered: false,
    lives: config.vidas,
    correctCount: 0,
    points: 0,
    streak: 0,
  };
  return { state, step: statementStep(state, config) };
}

export function answerTrueOrMyth(
  state: TrueOrMythGameState,
  config: TrueOrMythConfig,
  body: TrueOrMythAnswerBody,
  now: Date,
): {
  state: TrueOrMythGameState;
  response: Omit<TrueOrMythAnswerResult, 'result'>;
  tally: { score: number; points: number } | null;
} {
  const index = state.statementIndexes[state.position];
  const source = index === undefined ? undefined : config.afirmaciones[index];
  if (!source) {
    throw new StaleGameError();
  }
  if (state.answered || body.position !== state.position + 1) {
    throw new ConflictException('Esa afirmación no está en curso en tu partida');
  }
  const elapsed = secondsBetween(new Date(state.servedAt), now);
  const timedOut = body.value === null || isLate(elapsed, config.segundos_por_afirmacion);
  const correct = !timedOut && body.value === source.es_verdad;

  const streak = correct ? state.streak + 1 : 0;
  const pointsGained = correct
    ? trueOrMythPoints(elapsed, config.segundos_por_afirmacion, streak)
    : 0;
  const lives = correct ? state.lives : state.lives - 1;
  const next: TrueOrMythGameState = {
    ...state,
    answered: true,
    lives,
    correctCount: state.correctCount + (correct ? 1 : 0),
    points: state.points + pointsGained,
    streak,
  };
  // Sin vidas la partida termina aunque queden afirmaciones.
  const finished = lives <= 0 || state.position + 1 >= state.statementIndexes.length;
  return {
    state: next,
    response: {
      type: 'verdad_o_mito',
      correct,
      timedOut,
      isTrue: source.es_verdad,
      explanation: source.explicacion,
      lives,
      pointsGained,
      streak,
      totalPoints: next.points,
      position: state.position + 1,
      finished,
    },
    tally: finished
      ? {
          score: scorePercentage(next.correctCount, config.por_partida),
          points: next.points,
        }
      : null,
  };
}

export function nextTrueOrMyth(
  state: TrueOrMythGameState,
  config: TrueOrMythConfig,
  now: Date,
): { state: TrueOrMythGameState; step: StatementStep } {
  if (!state.answered) {
    throw new ConflictException('Responde la afirmación en curso antes de pasar a la siguiente');
  }
  if (state.lives <= 0 || state.position + 1 >= state.statementIndexes.length) {
    throw new ConflictException('La partida ya terminó');
  }
  const next: TrueOrMythGameState = {
    ...state,
    position: state.position + 1,
    servedAt: now.toISOString(),
    answered: false,
  };
  return { state: next, step: statementStep(next, config) };
}
