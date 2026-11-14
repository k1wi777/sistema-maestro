import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  answerChallenge,
  challengeScore,
  nextChallenge,
  StaleGameError,
  startChallenge,
  type EngineQuestion,
} from './challenge-engine';

const T0 = new Date('2026-11-09T10:00:00.000Z');
const after = (seconds: number): Date => new Date(T0.getTime() + seconds * 1000);

const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const choice: EngineQuestion = {
  id: ID(1),
  type: 'opcion',
  prompt: '¿Cuál?',
  feedback: 'Porque sí.',
  trueFalseAnswer: null,
  options: [
    { id: ID(11), text: 'Correcta', isCorrect: true, correctPosition: null },
    { id: ID(12), text: 'Mala', isCorrect: false, correctPosition: null },
    { id: ID(13), text: 'Otra mala', isCorrect: false, correctPosition: null },
  ],
};
const trueFalse: EngineQuestion = {
  id: ID(2),
  type: 'vf',
  prompt: '¿Verdad?',
  feedback: null,
  trueFalseAnswer: true,
  options: [],
};
const ordering: EngineQuestion = {
  id: ID(3),
  type: 'orden',
  prompt: 'Ordena',
  feedback: null,
  trueFalseAnswer: null,
  options: [
    { id: ID(31), text: 'Primero', isCorrect: null, correctPosition: 1 },
    { id: ID(32), text: 'Segundo', isCorrect: null, correctPosition: 2 },
    { id: ID(33), text: 'Tercero', isCorrect: null, correctPosition: 3 },
  ],
};

const noShuffle = () => 0;
const all = [choice, trueFalse, ordering];
const byId = (questions: readonly EngineQuestion[]) => new Map(questions.map((q) => [q.id, q]));

/** Con un generador fijo, `shuffled` rota la lista: se arma la partida sobre una pregunta conocida. */
function startOn(question: EngineQuestion, seconds: number | null = null) {
  return startChallenge([question], seconds, T0, noShuffle);
}

describe('challenge engine', () => {
  it('refuses to start without questions', () => {
    expect(() => startChallenge([], null, T0)).toThrow(ConflictException);
  });

  it('delivers a question without any correct answer, with its options', () => {
    const { step } = startOn(choice);

    expect(step).toMatchObject({ total: 1, position: 1, question: { id: choice.id, seconds: 20 } });
    expect(JSON.stringify(step)).not.toMatch(/isCorrect|correct|feedback|Porque/);
    expect(step.question.options?.map((option) => option.text).sort()).toEqual(
      ['Correcta', 'Mala', 'Otra mala'].sort(),
    );
  });

  it('delivers the steps to order shuffled, never in the correct order', () => {
    const { step } = startOn(ordering);

    expect(step.question.options?.map((option) => option.id)).not.toEqual([ID(31), ID(32), ID(33)]);
    expect(step.question.seconds).toBe(35);
  });

  it('uses the seconds of the module when it defines them', () => {
    expect(startOn(trueFalse, 12).step.question.seconds).toBe(12);
  });

  it('grades a correct option, reveals the answer and gives points', () => {
    const { state } = startOn(choice);

    const outcome = answerChallenge(
      state,
      byId([choice]),
      null,
      {
        questionId: choice.id,
        answer: { optionId: ID(11) },
      },
      after(5),
    );

    expect(outcome.response).toMatchObject({
      correct: true,
      timedOut: false,
      correctAnswer: { optionId: ID(11) },
      feedback: 'Porque sí.',
      pointsGained: 875,
      streak: 1,
      totalPoints: 875,
      finished: true,
    });
    expect(outcome.tally).toEqual({ correctCount: 1, total: 1, points: 875 });
  });

  it('counts a late answer as incorrect using the server clock', () => {
    const { state } = startOn(choice);

    const outcome = answerChallenge(
      state,
      byId([choice]),
      null,
      {
        questionId: choice.id,
        answer: { optionId: ID(11) },
      },
      after(23),
    );

    expect(outcome.response).toMatchObject({ correct: false, timedOut: true, pointsGained: 0 });
    expect(challengeScore(outcome.tally as { correctCount: number; total: number })).toBe(0);
  });

  it('accepts an answer inside the latency margin', () => {
    const { state } = startOn(choice);

    const outcome = answerChallenge(
      state,
      byId([choice]),
      null,
      {
        questionId: choice.id,
        answer: { optionId: ID(11) },
      },
      after(21.5),
    );

    expect(outcome.response.correct).toBe(true);
  });

  it('treats a null answer as a time-out', () => {
    const { state } = startOn(trueFalse);

    const outcome = answerChallenge(
      state,
      byId([trueFalse]),
      null,
      {
        questionId: trueFalse.id,
        answer: null,
      },
      after(1),
    );

    expect(outcome.response).toMatchObject({
      correct: false,
      timedOut: true,
      correctAnswer: { value: true },
    });
  });

  it('grades true or false and ordering answers', () => {
    const vf = answerChallenge(
      startOn(trueFalse).state,
      byId([trueFalse]),
      null,
      {
        questionId: trueFalse.id,
        answer: { value: true },
      },
      after(1),
    );
    const rightOrder = answerChallenge(
      startOn(ordering).state,
      byId([ordering]),
      null,
      {
        questionId: ordering.id,
        answer: { optionIds: [ID(31), ID(32), ID(33)] },
      },
      after(1),
    );
    const wrongOrder = answerChallenge(
      startOn(ordering).state,
      byId([ordering]),
      null,
      {
        questionId: ordering.id,
        answer: { optionIds: [ID(32), ID(31), ID(33)] },
      },
      after(1),
    );

    expect(vf.response.correct).toBe(true);
    expect(rightOrder.response.correct).toBe(true);
    expect(wrongOrder.response).toMatchObject({
      correct: false,
      correctAnswer: { optionIds: [ID(31), ID(32), ID(33)] },
    });
  });

  it.each([
    ['an option of another question', { optionId: ID(99) }],
    ['the wrong shape', { value: true }],
  ])('rejects %s with 400', (_name, answer) => {
    const { state } = startOn(choice);

    expect(() =>
      answerChallenge(state, byId([choice]), null, { questionId: choice.id, answer }, after(1)),
    ).toThrow(BadRequestException);
  });

  it('rejects an incomplete or repeated ordering with 400', () => {
    const { state } = startOn(ordering);

    expect(() =>
      answerChallenge(
        state,
        byId([ordering]),
        null,
        {
          questionId: ordering.id,
          answer: { optionIds: [ID(31), ID(31), ID(33)] },
        },
        after(1),
      ),
    ).toThrow(BadRequestException);
  });

  it('answers 409 for another question and for an answered one, without changing the score', () => {
    const { state } = startOn(choice);
    const answered = answerChallenge(
      state,
      byId([choice]),
      null,
      {
        questionId: choice.id,
        answer: { optionId: ID(11) },
      },
      after(1),
    );

    expect(() =>
      answerChallenge(state, byId([choice]), null, { questionId: ID(77), answer: null }, after(1)),
    ).toThrow(ConflictException);
    expect(() =>
      answerChallenge(
        answered.state,
        byId([choice]),
        null,
        {
          questionId: choice.id,
          answer: { optionId: ID(12) },
        },
        after(2),
      ),
    ).toThrow(ConflictException);
    expect(answered.state.points).toBe(answered.response.totalPoints);
  });

  it('runs a multi-question game with streaks and the final tally', () => {
    const questions = [trueFalse, trueFalse].map((q, index) => ({ ...q, id: ID(50 + index) }));
    let { state } = startChallenge(questions, null, T0, noShuffle);
    const map = byId(questions);
    const first = answerChallenge(
      state,
      map,
      null,
      {
        questionId: state.questionIds[0] as string,
        answer: { value: true },
      },
      T0,
    );
    expect(first.tally).toBeNull();
    expect(first.response).toMatchObject({ streak: 1, pointsGained: 1000, finished: false });

    expect(() => nextChallenge(state, map, null, after(1))).toThrow(ConflictException);
    const advanced = nextChallenge(first.state, map, null, after(3));
    state = advanced.state;
    expect(advanced.step.position).toBe(2);
    const second = answerChallenge(
      state,
      map,
      null,
      {
        questionId: state.questionIds[1] as string,
        answer: { value: true },
      },
      after(3),
    );

    expect(second.response).toMatchObject({ streak: 2, pointsGained: 1100, finished: true });
    expect(second.tally).toEqual({ correctCount: 2, total: 2, points: 2100 });
    expect(() => nextChallenge(second.state, map, null, after(4))).toThrow(ConflictException);
  });

  it('reports a stale game when a question was removed', () => {
    const { state } = startOn(choice);

    expect(() =>
      answerChallenge(state, new Map(), null, { questionId: choice.id, answer: null }, after(1)),
    ).toThrow(StaleGameError);
  });

  it('serves every chosen question exactly once', () => {
    const { state } = startChallenge(all, null, T0);

    expect([...state.questionIds].sort()).toEqual(all.map((q) => q.id).sort());
  });
});
