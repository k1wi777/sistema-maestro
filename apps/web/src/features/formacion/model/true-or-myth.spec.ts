import type { ActivityGameStep } from '@gns/shared';

import {
  answerBody,
  initialTrueOrMythState,
  trueOrMythAnnouncement,
  trueOrMythKey,
  trueOrMythReducer,
  type TrueOrMythEvent,
  type TrueOrMythState,
} from './true-or-myth';
import { GAME_RESULT, makeMythAnswer } from './test-fixtures-activities';

const statementStep = (position = 1): ActivityGameStep => ({
  type: 'verdad_o_mito',
  finished: false,
  total: 10,
  lives: 3,
  statement: { position, text: 'Afirmación', seconds: 10 },
});

function run(
  events: TrueOrMythEvent[],
  from: TrueOrMythState = initialTrueOrMythState(null),
): TrueOrMythState {
  return events.reduce(trueOrMythReducer, from);
}

const open = () => run([{ type: 'start' }, { type: 'step', step: statementStep() }]);
const answered = (overrides = {}) =>
  run(
    [
      { type: 'choose', value: true },
      { type: 'result', result: makeMythAnswer(overrides) },
    ],
    open(),
  );

describe('trueOrMythReducer', () => {
  it('goes from the lobby to the first statement with its lives', () => {
    const starting = run([{ type: 'start' }]);

    expect(starting).toMatchObject({ phase: 'starting', seq: 1 });
    expect(open()).toMatchObject({
      phase: 'statement',
      total: 10,
      lives: 3,
      statement: { position: 1 },
    });
  });

  it('sends one answer per statement: later choices and timeouts are ignored', () => {
    const sent = trueOrMythReducer(open(), { type: 'choose', value: false });

    expect(sent).toMatchObject({ phase: 'submitting', chosen: false, seq: 2 });
    expect(trueOrMythReducer(sent, { type: 'choose', value: true })).toBe(sent);
    expect(trueOrMythReducer(sent, { type: 'timeout' })).toBe(sent);
  });

  it('sends the timeout once, as an absent answer', () => {
    const timedOut = trueOrMythReducer(open(), { type: 'timeout' });

    expect(timedOut).toMatchObject({ phase: 'submitting', chosen: null });
    expect(answerBody(timedOut)).toEqual({ position: 1, value: null });
    expect(trueOrMythReducer(timedOut, { type: 'timeout' })).toBe(timedOut);
  });

  it('builds the body with the position of the statement and the chosen value', () => {
    const sent = trueOrMythReducer(open(), { type: 'choose', value: true });

    expect(answerBody(sent)).toEqual({ position: 1, value: true });
    expect(answerBody(initialTrueOrMythState(null))).toBeNull();
  });

  it('takes lives, points and streak from the API answer', () => {
    const state = answered({ correct: false, lives: 2, totalPoints: 40, streak: 0 });

    expect(state).toMatchObject({ phase: 'answered', lives: 2, points: 40, streak: 0 });
  });

  it('ignores a result outside submitting', () => {
    const state = open();

    expect(trueOrMythReducer(state, { type: 'result', result: makeMythAnswer() })).toBe(state);
  });

  it('asks for the next statement while the game goes on', () => {
    const next = trueOrMythReducer(answered(), { type: 'advance' });

    expect(next.phase).toBe('loadingNext');
    expect(trueOrMythReducer(next, { type: 'step', step: statementStep(2) })).toMatchObject({
      phase: 'statement',
      statement: { position: 2 },
      result: null,
      chosen: null,
    });
  });

  it('finishes without asking the API when the last answer finished the game', () => {
    const last = answered({ finished: true, lives: 0, result: GAME_RESULT });
    const done = trueOrMythReducer(last, { type: 'advance' });

    expect(done).toMatchObject({ phase: 'finished', best: { score: 100, points: 800 } });
    expect(done.final).toEqual(GAME_RESULT);
  });

  it('reports an error when it finished without a result', () => {
    const last = answered({ finished: true, lives: 0 });

    expect(trueOrMythReducer(last, { type: 'advance' })).toMatchObject({
      phase: 'error',
      retry: 'start',
    });
  });

  it('shows a lost game on a 409 and starts a new one keeping the best attempt', () => {
    const lost = run(
      [{ type: 'start' }, { type: 'conflict' }],
      initialTrueOrMythState({ score: 70, points: 300 }),
    );
    const sent = trueOrMythReducer(open(), { type: 'choose', value: true });

    expect(trueOrMythReducer(sent, { type: 'conflict' }).phase).toBe('lost');
    expect(lost.best).toEqual({ score: 70, points: 300 });
    expect(trueOrMythReducer(lost, { type: 'start' })).toMatchObject({
      phase: 'starting',
      best: { score: 70, points: 300 },
    });
  });

  it('keeps the statement on a network failure and retries the same answer', () => {
    const sent = trueOrMythReducer(open(), { type: 'choose', value: false });
    const failed = trueOrMythReducer(sent, { type: 'failed', message: 'Sin red' });

    expect(failed).toMatchObject({
      phase: 'error',
      retry: 'answer',
      statement: { position: 1 },
      chosen: false,
    });
    expect(trueOrMythReducer(failed, { type: 'retry' })).toMatchObject({
      phase: 'submitting',
      chosen: false,
      seq: failed.seq + 1,
    });
  });

  it('retries the start and the next step', () => {
    const start = run([{ type: 'start' }, { type: 'failed', message: 'x' }]);
    const next = run(
      [{ type: 'advance' }, { type: 'failed', message: 'x' }, { type: 'retry' }],
      answered(),
    );

    expect(trueOrMythReducer(start, { type: 'retry' }).phase).toBe('starting');
    expect(next.phase).toBe('loadingNext');
  });
});

describe('trueOrMythKey', () => {
  it('uses the left arrow for myth and the right arrow for truth', () => {
    expect(trueOrMythKey({ key: 'ArrowLeft', phase: 'statement' })).toEqual({
      type: 'choose',
      value: false,
    });
    expect(trueOrMythKey({ key: 'ArrowRight', phase: 'statement' })).toEqual({
      type: 'choose',
      value: true,
    });
  });

  it('advances with Enter only after answering', () => {
    expect(trueOrMythKey({ key: 'Enter', phase: 'answered' })).toEqual({ type: 'advance' });
    expect(trueOrMythKey({ key: 'Enter', phase: 'statement' })).toBeNull();
    expect(trueOrMythKey({ key: 'ArrowLeft', phase: 'answered' })).toBeNull();
  });

  it('does nothing in other phases, in text fields or with modifiers', () => {
    expect(trueOrMythKey({ key: 'ArrowRight', phase: 'submitting' })).toBeNull();
    expect(trueOrMythKey({ key: 'ArrowRight', phase: 'statement', inField: true })).toBeNull();
    expect(trueOrMythKey({ key: 'ArrowRight', phase: 'statement', modified: true })).toBeNull();
    expect(trueOrMythKey({ key: 'a', phase: 'statement' })).toBeNull();
  });
});

describe('trueOrMythAnnouncement', () => {
  it('announces the statement, the verdict and running out of lives', () => {
    expect(trueOrMythAnnouncement(open())).toBe('Afirmación 1 de 10. Afirmación');
    expect(trueOrMythAnnouncement(answered({ isTrue: false, correct: false, lives: 2 }))).toBe(
      'Incorrecto. Era mito. Porque sí. Te quedan 2 vidas.',
    );
    expect(
      trueOrMythAnnouncement(answered({ lives: 0, finished: true, result: GAME_RESULT })),
    ).toContain('Te quedaste sin vidas.');
    expect(
      trueOrMythAnnouncement(answered({ timedOut: true, correct: false, lives: 1 })),
    ).toContain('Se acabó el tiempo. Era verdad.');
  });
});
