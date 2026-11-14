import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  CHALLENGE_DEFAULT_SECONDS_PER_QUESTION,
  ChallengeQuestionType,
  type ChallengeAnswerBody,
  type ChallengeAnswerResult,
  type ChallengeStep,
} from '@gns/shared';
import { GAME_STATE_VERSION, type ChallengeGameState } from './game-state';
import { secureRandomInt, shuffled, shuffledDifferent, type RandomInt } from './random';
import { challengePoints, isLate, scorePercentage, secondsBetween } from './scoring';

/** La partida guardada ya no corresponde al contenido del módulo: se descarta (409). */
export class StaleGameError extends Error {}

export interface EngineQuestion {
  id: string;
  type: ChallengeQuestionType;
  prompt: string;
  feedback: string | null;
  trueFalseAnswer: boolean | null;
  options: {
    id: string;
    text: string;
    isCorrect: boolean | null;
    correctPosition: number | null;
  }[];
}

type AnswerValue = NonNullable<ChallengeAnswerBody['answer']>;

const secondsFor = (question: EngineQuestion, moduleSeconds: number | null): number =>
  moduleSeconds ?? CHALLENGE_DEFAULT_SECONDS_PER_QUESTION[question.type];

function currentQuestion(
  state: ChallengeGameState,
  questions: ReadonlyMap<string, EngineQuestion>,
): EngineQuestion {
  const id = state.questionIds[state.position];
  const question = id === undefined ? undefined : questions.get(id);
  if (!question) {
    throw new StaleGameError();
  }
  return question;
}

const correctOrder = (question: EngineQuestion): string[] =>
  [...question.options]
    .sort((a, b) => (a.correctPosition ?? 0) - (b.correctPosition ?? 0))
    .map((option) => option.id);

/** Pregunta en curso tal como se entrega: sin respuesta correcta y con las opciones mezcladas. */
export function challengeStep(
  state: ChallengeGameState,
  questions: ReadonlyMap<string, EngineQuestion>,
  moduleSeconds: number | null,
): ChallengeStep {
  const question = currentQuestion(state, questions);
  const base = {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    seconds: secondsFor(question, moduleSeconds),
  };
  const header = { total: state.questionIds.length, position: state.position + 1 };
  if (question.type === ChallengeQuestionType.TrueFalse) {
    return { ...header, question: base };
  }
  const order = state.optionOrder[question.id] ?? [];
  const byId = new Map(question.options.map((option) => [option.id, option]));
  if (order.length !== question.options.length || order.some((id) => !byId.has(id))) {
    throw new StaleGameError();
  }
  return {
    ...header,
    question: {
      ...base,
      options: order.map((id) => ({ id, text: (byId.get(id) as { text: string }).text })),
    },
  };
}

export function startChallenge(
  questions: readonly EngineQuestion[],
  moduleSeconds: number | null,
  now: Date,
  random: RandomInt = secureRandomInt,
): { state: ChallengeGameState; step: ChallengeStep } {
  if (questions.length === 0) {
    throw new ConflictException('Este módulo no tiene preguntas en el Desafío GNS');
  }
  const chosen = shuffled(questions, random);
  const optionOrder: Record<string, string[]> = {};
  for (const question of chosen) {
    if (question.type === ChallengeQuestionType.MultipleChoice) {
      optionOrder[question.id] = shuffled(
        question.options.map((option) => option.id),
        random,
      );
    } else if (question.type === ChallengeQuestionType.Ordering) {
      // Se parte del orden correcto y se entregan siempre desordenados.
      optionOrder[question.id] = shuffledDifferent(correctOrder(question), random);
    }
  }
  const state: ChallengeGameState = {
    version: GAME_STATE_VERSION,
    kind: 'desafio',
    startedAt: now.toISOString(),
    questionIds: chosen.map((question) => question.id),
    optionOrder,
    position: 0,
    servedAt: now.toISOString(),
    answered: false,
    correctCount: 0,
    points: 0,
    streak: 0,
    answers: [],
  };
  const map = new Map(chosen.map((question) => [question.id, question]));
  return { state, step: challengeStep(state, map, moduleSeconds) };
}

function invalidShape(): never {
  throw new BadRequestException('La respuesta no corresponde al tipo de la pregunta');
}

/** `true` si la respuesta es la correcta; 400 si no tiene la forma de la pregunta. */
function grade(question: EngineQuestion, answer: AnswerValue): boolean {
  switch (question.type) {
    case ChallengeQuestionType.MultipleChoice: {
      if (!('optionId' in answer)) {
        return invalidShape();
      }
      const option = question.options.find((candidate) => candidate.id === answer.optionId);
      if (!option) {
        throw new BadRequestException('La opción no pertenece a la pregunta');
      }
      return option.isCorrect === true;
    }
    case ChallengeQuestionType.TrueFalse:
      return 'value' in answer ? answer.value === question.trueFalseAnswer : invalidShape();
    case ChallengeQuestionType.Ordering: {
      if (!('optionIds' in answer)) {
        return invalidShape();
      }
      const expected = correctOrder(question);
      const given = new Set(answer.optionIds);
      if (
        answer.optionIds.length !== expected.length ||
        given.size !== expected.length ||
        expected.some((id) => !given.has(id))
      ) {
        throw new BadRequestException('Debes ordenar todos los pasos, sin repetir ninguno');
      }
      return expected.every((id, index) => answer.optionIds[index] === id);
    }
  }
}

function correctAnswerOf(question: EngineQuestion): AnswerValue {
  switch (question.type) {
    case ChallengeQuestionType.MultipleChoice:
      return { optionId: question.options.find((option) => option.isCorrect === true)?.id ?? '' };
    case ChallengeQuestionType.TrueFalse:
      return { value: question.trueFalseAnswer === true };
    case ChallengeQuestionType.Ordering:
      return { optionIds: correctOrder(question) };
  }
}

export interface ChallengeAnswerOutcome {
  state: ChallengeGameState;
  response: Omit<ChallengeAnswerResult, 'result'>;
  /** Presente al responder la última pregunta. */
  tally: { correctCount: number; total: number; points: number } | null;
}

export function answerChallenge(
  state: ChallengeGameState,
  questions: ReadonlyMap<string, EngineQuestion>,
  moduleSeconds: number | null,
  body: ChallengeAnswerBody,
  now: Date,
): ChallengeAnswerOutcome {
  const question = currentQuestion(state, questions);
  if (state.answered || body.questionId !== question.id) {
    throw new ConflictException('Esa pregunta no está en curso en tu partida');
  }
  const limit = secondsFor(question, moduleSeconds);
  const elapsed = secondsBetween(new Date(state.servedAt), now);
  // La forma de la respuesta se valida siempre: un 400 no depende del reloj.
  const isRight = body.answer === null ? false : grade(question, body.answer);
  const timedOut = body.answer === null || isLate(elapsed, limit);
  const correct = !timedOut && isRight;

  const streak = correct ? state.streak + 1 : 0;
  const pointsGained = correct ? challengePoints(elapsed, limit, streak) : 0;
  const next: ChallengeGameState = {
    ...state,
    answered: true,
    correctCount: state.correctCount + (correct ? 1 : 0),
    points: state.points + pointsGained,
    streak,
    answers: [...state.answers, { questionId: question.id, correct, timedOut }],
  };
  const finished = state.position + 1 >= state.questionIds.length;
  return {
    state: next,
    response: {
      correct,
      timedOut,
      correctAnswer: correctAnswerOf(question),
      feedback: question.feedback,
      pointsGained,
      streak,
      totalPoints: next.points,
      position: state.position + 1,
      finished,
    },
    tally: finished
      ? { correctCount: next.correctCount, total: state.questionIds.length, points: next.points }
      : null,
  };
}

export function nextChallenge(
  state: ChallengeGameState,
  questions: ReadonlyMap<string, EngineQuestion>,
  moduleSeconds: number | null,
  now: Date,
): { state: ChallengeGameState; step: ChallengeStep } {
  if (!state.answered) {
    throw new ConflictException('Responde la pregunta en curso antes de pasar a la siguiente');
  }
  if (state.position + 1 >= state.questionIds.length) {
    throw new ConflictException('La partida ya terminó');
  }
  const next: ChallengeGameState = {
    ...state,
    position: state.position + 1,
    servedAt: now.toISOString(),
    answered: false,
  };
  return { state: next, step: challengeStep(next, questions, moduleSeconds) };
}

export const challengeScore = (tally: { correctCount: number; total: number }): number =>
  scorePercentage(tally.correctCount, tally.total);
