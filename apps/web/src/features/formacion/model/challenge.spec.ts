import type { ChallengeAnswerResult, ChallengeStep } from '@gns/shared';

import {
  answerBody,
  challengeReducer,
  initialChallengeState,
  type ChallengeEvent,
  type ChallengeState,
} from './challenge';
import { uuid } from './test-fixtures';

const options = [uuid(1), uuid(2), uuid(3)].map((id, index) => ({
  id,
  text: `Opción ${index + 1}`,
}));

const step = (type: 'opcion' | 'vf' | 'orden' = 'opcion', position = 1): ChallengeStep => ({
  total: 3,
  position,
  question: {
    id: uuid(50 + position),
    type,
    prompt: 'Pregunta',
    seconds: 20,
    ...(type === 'vf' ? {} : { options }),
  },
});

const graded = (overrides: Partial<ChallengeAnswerResult> = {}): ChallengeAnswerResult => ({
  correct: true,
  timedOut: false,
  correctAnswer: { optionId: uuid(1) },
  feedback: 'Bien',
  pointsGained: 800,
  streak: 1,
  totalPoints: 800,
  position: 1,
  finished: false,
  ...overrides,
});

const run = (events: ChallengeEvent[], from?: ChallengeState): ChallengeState =>
  events.reduce(challengeReducer, from ?? initialChallengeState(null));

const onQuestion = (type: 'opcion' | 'vf' | 'orden' = 'opcion') =>
  run([{ type: 'start' }, { type: 'step', step: step(type) }]);

describe('challengeReducer', () => {
  it('goes from the lobby to the first question and keeps the best attempt', () => {
    const state = run(
      [{ type: 'start' }, { type: 'step', step: step() }],
      initialChallengeState({ score: 67, points: 4120 }),
    );

    expect(state.phase).toBe('question');
    expect(state.best).toEqual({ score: 67, points: 4120 });
  });

  it('accepts a single answer per question', () => {
    const answered = run([{ type: 'choose', answer: { optionId: uuid(2) } }], onQuestion());
    const again = challengeReducer(answered, { type: 'choose', answer: { optionId: uuid(3) } });

    expect(answered.phase).toBe('submitting');
    expect(again).toBe(answered);
    expect(answerBody(answered)).toEqual({ questionId: uuid(51), answer: { optionId: uuid(2) } });
  });

  it('rejects an answer that does not match the question type or options', () => {
    const state = onQuestion('opcion');

    expect(challengeReducer(state, { type: 'choose', answer: { value: true } })).toBe(state);
    expect(challengeReducer(state, { type: 'choose', answer: { optionId: uuid(99) } })).toBe(state);
  });

  it('answers true or false with a boolean value', () => {
    const state = run([{ type: 'choose', answer: { value: false } }], onQuestion('vf'));

    expect(state.phase).toBe('submitting');
    expect(answerBody(state)?.answer).toEqual({ value: false });
  });

  it('sends the timeout once as a null answer', () => {
    const timedOut = run([{ type: 'timeout' }], onQuestion());
    const again = challengeReducer(timedOut, { type: 'timeout' });

    expect(timedOut.phase).toBe('submitting');
    expect(answerBody(timedOut)?.answer).toBeNull();
    expect(again).toBe(timedOut);
  });

  it('ignores a late timeout or choice once the answer was graded', () => {
    const answered = run(
      [
        { type: 'choose', answer: { optionId: uuid(1) } },
        { type: 'result', result: graded() },
      ],
      onQuestion(),
    );

    expect(challengeReducer(answered, { type: 'timeout' })).toBe(answered);
    expect(challengeReducer(answered, { type: 'choose', answer: { optionId: uuid(2) } })).toBe(
      answered,
    );
    expect(answered).toMatchObject({ phase: 'answered', points: 800, streak: 1 });
  });

  it('orders by placing, removing and confirming only when every step is placed', () => {
    let state = onQuestion('orden');
    state = run(
      [
        { type: 'place', optionId: uuid(3) },
        { type: 'place', optionId: uuid(3) },
        { type: 'place', optionId: uuid(1) },
      ],
      state,
    );
    expect(state.placed).toEqual([uuid(3), uuid(1)]);
    expect(challengeReducer(state, { type: 'confirmOrder' })).toBe(state);

    state = run(
      [
        { type: 'unplace', optionId: uuid(3) },
        { type: 'place', optionId: uuid(2) },
      ],
      state,
    );
    expect(state.placed).toEqual([uuid(1), uuid(2)]);

    state = run(
      [
        { type: 'unplaceLast' },
        { type: 'place', optionId: uuid(3) },
        { type: 'place', optionId: uuid(2) },
      ],
      state,
    );
    expect(state.placed).toEqual([uuid(1), uuid(3), uuid(2)]);

    const sent = challengeReducer(state, { type: 'confirmOrder' });
    expect(sent.phase).toBe('submitting');
    expect(answerBody(sent)?.answer).toEqual({ optionIds: [uuid(1), uuid(3), uuid(2)] });
  });

  it('does not place options on a non-ordering question', () => {
    const state = onQuestion('opcion');

    expect(challengeReducer(state, { type: 'place', optionId: uuid(1) })).toBe(state);
  });

  it('moves to the next question and finishes with the final result', () => {
    const last = graded({
      finished: true,
      result: {
        score: 90,
        points: 5000,
        passed: true,
        bestScore: 90,
        bestPoints: 5000,
        completedAt: new Date('2026-11-09T10:00:00Z'),
      },
    });
    let state = run(
      [
        { type: 'choose', answer: { optionId: uuid(1) } },
        { type: 'result', result: graded() },
        { type: 'advance' },
      ],
      onQuestion(),
    );
    expect(state.phase).toBe('loadingNext');

    state = run(
      [
        { type: 'step', step: step('opcion', 2) },
        { type: 'choose', answer: { optionId: uuid(1) } },
        { type: 'result', result: last },
        { type: 'advance' },
      ],
      state,
    );

    expect(state.phase).toBe('finished');
    expect(state.final?.passed).toBe(true);
    expect(state.best).toEqual({ score: 90, points: 5000 });
  });

  it('turns a 409 on answer into a lost game that keeps the best result', () => {
    const base = initialChallengeState({ score: 80, points: 3000 });
    const lost = run(
      [
        { type: 'start' },
        { type: 'step', step: step() },
        { type: 'choose', answer: { optionId: uuid(1) } },
        { type: 'conflict' },
      ],
      base,
    );

    expect(lost.phase).toBe('lost');
    expect(lost.best).toEqual({ score: 80, points: 3000 });
    expect(run([{ type: 'start' }], lost).phase).toBe('starting');
  });

  it('turns a 409 while loading the next question into a lost game', () => {
    const state = run(
      [
        { type: 'choose', answer: { optionId: uuid(1) } },
        { type: 'result', result: graded() },
        { type: 'advance' },
        { type: 'conflict' },
      ],
      onQuestion(),
    );

    expect(state.phase).toBe('lost');
  });

  it('retries the failed request after a network error', () => {
    const failed = run(
      [
        { type: 'choose', answer: { optionId: uuid(1) } },
        { type: 'failed', message: 'Sin red' },
      ],
      onQuestion(),
    );
    const retried = challengeReducer(failed, { type: 'retry' });

    expect(failed).toMatchObject({ phase: 'error', retry: 'answer', errorMessage: 'Sin red' });
    expect(retried.phase).toBe('submitting');
    expect(retried.seq).toBeGreaterThan(failed.seq);
    expect(answerBody(retried)?.answer).toEqual({ optionId: uuid(1) });
  });

  it('retries starting and loading the next question', () => {
    const start = run([{ type: 'start' }, { type: 'failed', message: 'x' }]);
    expect(challengeReducer(start, { type: 'retry' }).phase).toBe('starting');

    const next = run(
      [
        { type: 'choose', answer: { optionId: uuid(1) } },
        { type: 'result', result: graded() },
        { type: 'advance' },
        { type: 'failed', message: 'x' },
      ],
      onQuestion(),
    );
    expect(challengeReducer(next, { type: 'retry' }).phase).toBe('loadingNext');
  });

  it('ignores events that do not belong to the current phase', () => {
    const lobby = initialChallengeState(null);

    expect(challengeReducer(lobby, { type: 'step', step: step() })).toBe(lobby);
    expect(challengeReducer(lobby, { type: 'result', result: graded() })).toBe(lobby);
    expect(challengeReducer(lobby, { type: 'advance' })).toBe(lobby);
    expect(challengeReducer(lobby, { type: 'conflict' })).toBe(lobby);
    expect(challengeReducer(lobby, { type: 'failed', message: 'x' })).toBe(lobby);
    expect(challengeReducer(onQuestion(), { type: 'start' }).phase).toBe('question');
  });
});
