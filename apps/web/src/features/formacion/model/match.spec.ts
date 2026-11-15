import type { ActivityGameStep } from '@gns/shared';

import {
  advanceDelayMs,
  initialMatchState,
  matchAnnouncement,
  matchReducer,
  type MatchEvent,
  type MatchState,
} from './match';
import { GAME_RESULT, makeMatchAnswer, makeMatchRound } from './test-fixtures-activities';

const roundStep = (round = makeMatchRound()): ActivityGameStep => ({
  type: 'conecta',
  finished: false,
  round,
});
const finishedStep: ActivityGameStep = { type: 'conecta', finished: true, result: GAME_RESULT };

function run(events: MatchEvent[], from: MatchState = initialMatchState(null)): MatchState {
  return events.reduce(matchReducer, from);
}

const playing = () => run([{ type: 'start' }, { type: 'step', step: roundStep() }]);

describe('matchReducer: start and rounds', () => {
  it('goes from the lobby to the first round', () => {
    const starting = run([{ type: 'start' }]);

    expect(starting).toMatchObject({ phase: 'starting', seq: 1 });
    expect(matchReducer(starting, { type: 'step', step: roundStep() })).toMatchObject({
      phase: 'playing',
      connectedConcepts: [],
      overBy: null,
    });
  });

  it('keeps points and streak from one round to the next', () => {
    let state = playing();
    state = run(
      [
        { type: 'selectConcept', token: 'c1' },
        { type: 'selectFact', token: 'f1' },
        {
          type: 'answered',
          result: makeMatchAnswer({ totalPoints: 150, streak: 2, connected: 1 }),
        },
        { type: 'timeout' },
        { type: 'advance' },
      ],
      state,
    );

    expect(state.phase).toBe('loadingNext');
    state = matchReducer(state, { type: 'step', step: roundStep(makeMatchRound({ round: 2 })) });
    expect(state).toMatchObject({
      phase: 'playing',
      points: 150,
      streak: 2,
      connectedConcepts: [],
    });
    expect(state.round?.round).toBe(2);
  });

  it('shows the result when next answers that the game finished', () => {
    const state = run(
      [{ type: 'timeout' }, { type: 'advance' }, { type: 'step', step: finishedStep }],
      playing(),
    );

    expect(state).toMatchObject({ phase: 'finished', best: { score: 100, points: 800 } });
    expect(state.final).toEqual(GAME_RESULT);
  });

  it('reports an error when the game finishes without a result', () => {
    const state = run(
      [
        { type: 'timeout' },
        { type: 'advance' },
        { type: 'step', step: { type: 'conecta', finished: true } },
      ],
      playing(),
    );

    expect(state).toMatchObject({ phase: 'error', retry: 'start' });
  });
});

describe('matchReducer: one union at a time', () => {
  it('sends the union when a concept and a fact are selected, in any order', () => {
    const conceptFirst = run(
      [
        { type: 'selectConcept', token: 'c1' },
        { type: 'selectFact', token: 'f2' },
      ],
      playing(),
    );
    const factFirst = run(
      [
        { type: 'selectFact', token: 'f2' },
        { type: 'selectConcept', token: 'c1' },
      ],
      playing(),
    );

    expect(conceptFirst.pending).toEqual({ conceptToken: 'c1', factToken: 'f2' });
    expect(factFirst.pending).toEqual({ conceptToken: 'c1', factToken: 'f2' });
    expect(conceptFirst.seq).toBe(2);
  });

  it('ignores any selection while a union is in flight', () => {
    const inFlight = run(
      [
        { type: 'selectConcept', token: 'c1' },
        { type: 'selectFact', token: 'f1' },
      ],
      playing(),
    );

    expect(matchReducer(inFlight, { type: 'selectConcept', token: 'c2' })).toBe(inFlight);
    expect(matchReducer(inFlight, { type: 'selectFact', token: 'f2' })).toBe(inFlight);
    expect(matchReducer(inFlight, { type: 'clearSelection' })).toBe(inFlight);
  });

  it('deselects a concept pressed twice and ignores unknown tokens', () => {
    const state = playing();
    const selected = matchReducer(state, { type: 'selectConcept', token: 'c1' });

    expect(selected.concept).toBe('c1');
    expect(matchReducer(selected, { type: 'selectConcept', token: 'c1' }).concept).toBeNull();
    expect(matchReducer(state, { type: 'selectConcept', token: 'x' })).toBe(state);
    expect(matchReducer(selected, { type: 'clearSelection' }).concept).toBeNull();
  });

  it('connects a correct union and never lets it be sent again', () => {
    let state = run(
      [
        { type: 'selectConcept', token: 'c1' },
        { type: 'selectFact', token: 'f1' },
        { type: 'answered', result: makeMatchAnswer({ totalPoints: 100, streak: 1 }) },
      ],
      playing(),
    );

    expect(state).toMatchObject({
      connectedConcepts: ['c1'],
      connectedFacts: ['f1'],
      pending: null,
      concept: null,
      points: 100,
      notice: 'hit',
      phase: 'playing',
    });
    const again = matchReducer(state, { type: 'selectConcept', token: 'c1' });
    expect(again).toBe(state);
    state = matchReducer(state, { type: 'selectFact', token: 'f1' });
    expect(state.fact).toBeNull();
  });

  it('clears the selection and keeps both free after a wrong union', () => {
    const state = run(
      [
        { type: 'selectConcept', token: 'c1' },
        { type: 'selectFact', token: 'f2' },
        {
          type: 'answered',
          result: makeMatchAnswer({
            correct: false,
            firstAttempt: false,
            pointsGained: 0,
            streak: 0,
          }),
        },
      ],
      playing(),
    );

    expect(state).toMatchObject({
      concept: null,
      fact: null,
      connectedConcepts: [],
      notice: 'miss',
      streak: 0,
    });
  });

  it('ignores an answer that arrives without a union in flight', () => {
    const state = playing();

    expect(matchReducer(state, { type: 'answered', result: makeMatchAnswer() })).toBe(state);
  });
});

describe('matchReducer: closing a round', () => {
  const connectAll = () =>
    run(
      [
        { type: 'selectConcept', token: 'c2' },
        { type: 'selectFact', token: 'f2' },
        {
          type: 'answered',
          result: makeMatchAnswer({ connected: 2, roundOver: true, totalPoints: 220 }),
        },
      ],
      playing(),
    );

  it('closes the round when all pairs are connected and ignores later unions', () => {
    const over = connectAll();

    expect(over).toMatchObject({ phase: 'roundOver', overBy: 'complete', notice: 'complete' });
    expect(matchReducer(over, { type: 'selectConcept', token: 'c1' })).toBe(over);
  });

  it('closes the round when the time runs out, only once', () => {
    const over = matchReducer(playing(), { type: 'timeout' });

    expect(over).toMatchObject({ phase: 'roundOver', overBy: 'time' });
    expect(matchReducer(over, { type: 'timeout' })).toBe(over);
    expect(matchReducer(over, { type: 'selectFact', token: 'f1' })).toBe(over);
  });

  it('takes the API closing the round as late', () => {
    const state = run(
      [
        { type: 'selectConcept', token: 'c1' },
        { type: 'selectFact', token: 'f1' },
        {
          type: 'answered',
          result: makeMatchAnswer({ correct: false, roundOver: true, streak: 0, pointsGained: 0 }),
        },
      ],
      playing(),
    );

    expect(state).toMatchObject({ phase: 'roundOver', overBy: 'late' });
  });

  it('still resolves a union that was in flight when the time ran out', () => {
    const state = run(
      [
        { type: 'selectConcept', token: 'c1' },
        { type: 'selectFact', token: 'f1' },
        { type: 'timeout' },
      ],
      playing(),
    );

    expect(state.pending).not.toBeNull();
    expect(matchReducer(state, { type: 'advance' })).toBe(state);
    const resolved = matchReducer(state, {
      type: 'answered',
      result: makeMatchAnswer({ totalPoints: 90 }),
    });
    expect(resolved).toMatchObject({ pending: null, points: 90, connectedConcepts: ['c1'] });
  });

  it('waits for the server margin only after a local timeout', () => {
    expect(advanceDelayMs('time')).toBe(2500);
    expect(advanceDelayMs('complete')).toBe(0);
    expect(advanceDelayMs('late')).toBe(0);
    expect(advanceDelayMs(null)).toBe(0);
  });

  it('asks for the next step from a closed round, and from nowhere else', () => {
    const over = connectAll();

    expect(matchReducer(over, { type: 'advance' })).toMatchObject({
      phase: 'loadingNext',
      seq: over.seq + 1,
    });
    const open = playing();
    expect(matchReducer(open, { type: 'advance' })).toBe(open);
  });

  it('finishes without asking the API when the last answer already finished the game', () => {
    const last = run(
      [
        { type: 'selectConcept', token: 'c2' },
        { type: 'selectFact', token: 'f2' },
        {
          type: 'answered',
          result: makeMatchAnswer({ roundOver: true, finished: true, result: GAME_RESULT }),
        },
      ],
      playing(),
    );

    expect(last).toMatchObject({ phase: 'roundOver', ended: true });
    expect(matchReducer(last, { type: 'advance' })).toMatchObject({
      phase: 'finished',
      final: GAME_RESULT,
    });
  });
});

describe('matchReducer: failures', () => {
  const inFlight = () =>
    run(
      [
        { type: 'selectConcept', token: 'c1' },
        { type: 'selectFact', token: 'f1' },
      ],
      playing(),
    );

  it('keeps the round on a network failure and retries the same union', () => {
    const failed = matchReducer(inFlight(), { type: 'failed', message: 'Sin red' });

    expect(failed).toMatchObject({ phase: 'error', retry: 'answer' });
    expect(failed.round?.round).toBe(1);
    expect(failed.pending).toEqual({ conceptToken: 'c1', factToken: 'f1' });
    expect(matchReducer(failed, { type: 'retry' })).toMatchObject({
      phase: 'playing',
      seq: failed.seq + 1,
    });
  });

  it('retries the start and the next step', () => {
    const starting = run([{ type: 'start' }, { type: 'failed', message: 'x' }]);

    expect(starting.retry).toBe('start');
    expect(matchReducer(starting, { type: 'retry' }).phase).toBe('starting');
    const next = run(
      [{ type: 'timeout' }, { type: 'advance' }, { type: 'failed', message: 'x' }],
      playing(),
    );
    expect(next.retry).toBe('next');
    expect(matchReducer(next, { type: 'retry' }).phase).toBe('loadingNext');
  });

  it('shows a lost game on a 409 and lets the teacher start a new one', () => {
    const lost = matchReducer(inFlight(), { type: 'conflict' });

    expect(lost).toMatchObject({ phase: 'lost', pending: null });
    expect(matchReducer(lost, { type: 'start' }).phase).toBe('starting');
  });

  it('ignores a conflict in the lobby', () => {
    const lobby = initialMatchState(null);

    expect(matchReducer(lobby, { type: 'conflict' })).toBe(lobby);
  });

  it('keeps the best attempt through a lost game', () => {
    const state = run(
      [{ type: 'start' }, { type: 'conflict' }],
      initialMatchState({ score: 80, points: 500 }),
    );

    expect(state.best).toEqual({ score: 80, points: 500 });
  });
});

describe('matchAnnouncement', () => {
  it('describes each fact of the game', () => {
    expect(matchAnnouncement(playing())).toBe('Ronda 1 de 2.');
    const miss = run(
      [
        { type: 'selectConcept', token: 'c1' },
        { type: 'selectFact', token: 'f2' },
        { type: 'answered', result: makeMatchAnswer({ correct: false, streak: 0 }) },
      ],
      playing(),
    );
    expect(matchAnnouncement(miss)).toBe('No es su pareja.');
    expect(matchAnnouncement(matchReducer(playing(), { type: 'timeout' }))).toBe(
      'Se acabó el tiempo de la ronda.',
    );
    const finished = run(
      [{ type: 'timeout' }, { type: 'advance' }, { type: 'step', step: finishedStep }],
      playing(),
    );
    expect(matchAnnouncement(finished)).toBe('Partida terminada: 100 por ciento. Aprobaste.');
  });
});
