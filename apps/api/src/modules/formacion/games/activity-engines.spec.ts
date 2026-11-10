import { BadRequestException, ConflictException } from '@nestjs/common';
import type { MatchConfig, TrueOrMythConfig } from '@gns/shared';
import { answerMatch, matchRound, nextMatch, startMatch } from './match-engine';
import { answerTrueOrMyth, nextTrueOrMyth, startTrueOrMyth } from './true-or-myth-engine';

const T0 = new Date('2026-11-09T10:00:00.000Z');
const after = (seconds: number): Date => new Date(T0.getTime() + seconds * 1000);
const noShuffle = () => 0;

const matchConfig: MatchConfig = {
  pares: [
    { concepto: 'Uno', dato: 'dato uno' },
    { concepto: 'Dos', dato: 'dato dos' },
    { concepto: 'Tres', dato: 'dato tres' },
    { concepto: 'Cuatro', dato: 'dato cuatro' },
  ],
  pares_por_ronda: 2,
  rondas: 2,
  segundos_por_ronda: 30,
  umbral_aprobacion: 80,
};

const mythConfig: TrueOrMythConfig = {
  afirmaciones: [
    { texto: 'A es verdad', es_verdad: true, explicacion: 'Porque A.' },
    { texto: 'B es mito', es_verdad: false, explicacion: 'Porque B.' },
    { texto: 'C es verdad', es_verdad: true, explicacion: 'Porque C.' },
  ],
  por_partida: 3,
  vidas: 2,
  segundos_por_afirmacion: 10,
  umbral_aprobacion: 60,
};

describe('match engine', () => {
  it('delivers the round with opaque tokens and no pairing', () => {
    const { round } = startMatch(matchConfig, T0, T0, noShuffle);

    expect(round).toMatchObject({ round: 1, totalRounds: 2, seconds: 30 });
    expect(round.concepts).toHaveLength(2);
    expect(round.facts).toHaveLength(2);
    expect(JSON.stringify(round)).not.toMatch(/conceptToken|factToken|pairs/);
    const tokens = [...round.concepts, ...round.facts].map((item) => item.token);
    expect(new Set(tokens).size).toBe(4);
  });

  /** Pareja (concepto, dato) correcta y una equivocada de la ronda en curso. */
  function pairsOf(state: ReturnType<typeof startMatch>['state']) {
    const round = state.rounds[state.roundIndex]!;
    return round.pairs;
  }

  it('connects a pair at the first attempt and scores it', () => {
    const { state } = startMatch(matchConfig, T0, T0, noShuffle);
    const [first] = pairsOf(state);

    const outcome = answerMatch(
      state,
      matchConfig,
      { conceptToken: first!.conceptToken, factToken: first!.factToken },
      T0,
    );

    expect(outcome.response).toMatchObject({
      correct: true,
      firstAttempt: true,
      pointsGained: 400,
      streak: 1,
      connected: 1,
      roundOver: false,
      finished: false,
    });
  });

  it('breaks the streak on a wrong pair and gives no first-attempt bonus afterwards', () => {
    const { state } = startMatch(matchConfig, T0, T0, noShuffle);
    const [a, b] = pairsOf(state);

    const wrong = answerMatch(
      state,
      matchConfig,
      { conceptToken: a!.conceptToken, factToken: b!.factToken },
      T0,
    );
    const retry = answerMatch(
      wrong.state,
      matchConfig,
      { conceptToken: a!.conceptToken, factToken: a!.factToken },
      T0,
    );

    expect(wrong.response).toMatchObject({ correct: false, pointsGained: 0, streak: 0 });
    expect(retry.response).toMatchObject({ correct: true, firstAttempt: false, pointsGained: 200 });
    expect(retry.state.firstAttempts).toBe(0);
  });

  it('answers 409 for an already connected concept and 400 for unknown tokens', () => {
    const { state } = startMatch(matchConfig, T0, T0, noShuffle);
    const [a] = pairsOf(state);
    const first = answerMatch(
      state,
      matchConfig,
      { conceptToken: a!.conceptToken, factToken: a!.factToken },
      T0,
    );

    expect(() =>
      answerMatch(
        first.state,
        matchConfig,
        { conceptToken: a!.conceptToken, factToken: a!.factToken },
        T0,
      ),
    ).toThrow(ConflictException);
    expect(() =>
      answerMatch(state, matchConfig, { conceptToken: 'x', factToken: 'y' }, T0),
    ).toThrow(BadRequestException);
  });

  it('plays two rounds and finishes with the score of first attempts', () => {
    let { state } = startMatch(matchConfig, T0, T0, noShuffle);
    let last: ReturnType<typeof answerMatch> | undefined;
    for (let round = 0; round < 2; round += 1) {
      const pairs = pairsOf(state);
      for (const pair of pairs) {
        last = answerMatch(
          state,
          matchConfig,
          { conceptToken: pair.conceptToken, factToken: pair.factToken },
          after(round * 10),
        );
        state = last.state;
      }
      if (round === 0) {
        expect(last?.response).toMatchObject({ roundOver: true, finished: false });
        const next = nextMatch(state, matchConfig, after(10));
        expect(next.round?.round).toBe(2);
        state = next.state;
      }
    }

    expect(last?.response).toMatchObject({ roundOver: true, finished: true });
    expect(last?.tally?.score).toBe(100);
  });

  it('refuses next while the round is open and in time, and closes it after the time ends', () => {
    const { state } = startMatch(matchConfig, T0, T0, noShuffle);

    expect(() => nextMatch(state, matchConfig, after(5))).toThrow(ConflictException);
    const closed = nextMatch(state, matchConfig, after(40));
    expect(closed.round?.round).toBe(2);
    expect(closed.state.streak).toBe(0);
  });

  it('does not score an answer after the round time and closes the round', () => {
    const { state } = startMatch(matchConfig, T0, T0, noShuffle);
    const [a] = pairsOf(state);

    const outcome = answerMatch(
      state,
      matchConfig,
      { conceptToken: a!.conceptToken, factToken: a!.factToken },
      after(40),
    );

    expect(outcome.response).toMatchObject({ correct: false, pointsGained: 0, roundOver: true });
    expect(outcome.state.points).toBe(0);
    expect(() =>
      answerMatch(
        outcome.state,
        matchConfig,
        { conceptToken: a!.conceptToken, factToken: a!.factToken },
        after(41),
      ),
    ).toThrow(ConflictException);
  });

  it('finishes with a zero score when every round runs out of time', () => {
    const { state } = startMatch(matchConfig, T0, T0, noShuffle);
    const second = nextMatch(state, matchConfig, after(40));
    const done = nextMatch(second.state, matchConfig, after(100));

    expect(done.round).toBeNull();
    expect(done.tally).toEqual({ score: 0, points: 0 });
    expect(matchRound(second.state, matchConfig).round).toBe(2);
  });
});

describe('true or myth engine', () => {
  it('delivers a statement without its verdict', () => {
    const { step } = startTrueOrMyth(mythConfig, T0, T0, noShuffle);

    expect(step).toMatchObject({ total: 3, lives: 2, statement: { position: 1, seconds: 10 } });
    expect(JSON.stringify(step)).not.toMatch(/es_verdad|explicacion|Porque/);
  });

  /** Responde cada afirmación con su veredicto y devuelve el resultado de la última. */
  function playCorrectly() {
    let { state } = startTrueOrMyth(mythConfig, T0, T0, noShuffle);
    for (let step = 0; ; step += 1) {
      const source = mythConfig.afirmaciones[state.statementIndexes[state.position]!]!;
      const outcome = answerTrueOrMyth(
        state,
        mythConfig,
        { position: step + 1, value: source.es_verdad },
        after(step),
      );
      if (outcome.response.finished) {
        return outcome;
      }
      state = nextTrueOrMyth(outcome.state, mythConfig, after(step + 1)).state;
    }
  }

  it('reveals the verdict and the explanation after answering', () => {
    const { state } = startTrueOrMyth(mythConfig, T0, T0, noShuffle);
    const source = mythConfig.afirmaciones[state.statementIndexes[0]!]!;

    const outcome = answerTrueOrMyth(
      state,
      mythConfig,
      { position: 1, value: source.es_verdad },
      T0,
    );

    expect(outcome.response).toMatchObject({
      correct: true,
      isTrue: source.es_verdad,
      explanation: source.explicacion,
      pointsGained: 500,
    });
  });

  it('takes a life for an error or a time-out and ends the game without lives', () => {
    const { state } = startTrueOrMyth(mythConfig, T0, T0, noShuffle);
    const source = mythConfig.afirmaciones[state.statementIndexes[0]!]!;
    const wrong = answerTrueOrMyth(
      state,
      mythConfig,
      { position: 1, value: !source.es_verdad },
      T0,
    );
    expect(wrong.response).toMatchObject({ correct: false, lives: 1, finished: false });

    const next = nextTrueOrMyth(wrong.state, mythConfig, after(1));
    const timedOut = answerTrueOrMyth(
      next.state,
      mythConfig,
      { position: 2, value: null },
      after(1),
    );

    expect(timedOut.response).toMatchObject({ timedOut: true, lives: 0, finished: true });
    expect(timedOut.tally).toEqual({ score: 0, points: 0 });
    expect(() => nextTrueOrMyth(timedOut.state, mythConfig, after(2))).toThrow(ConflictException);
  });

  it('finishes after the last statement with the score of correct answers', () => {
    const last = playCorrectly();

    expect(last.response).toMatchObject({ finished: true, position: 3 });
    expect(last.tally?.score).toBe(100);
  });

  it('answers 409 for another statement or an answered one', () => {
    const { state } = startTrueOrMyth(mythConfig, T0, T0, noShuffle);
    const answered = answerTrueOrMyth(state, mythConfig, { position: 1, value: true }, T0);

    expect(() => answerTrueOrMyth(state, mythConfig, { position: 2, value: true }, T0)).toThrow(
      ConflictException,
    );
    expect(() =>
      answerTrueOrMyth(answered.state, mythConfig, { position: 1, value: true }, T0),
    ).toThrow(ConflictException);
    expect(() => nextTrueOrMyth(state, mythConfig, T0)).toThrow(ConflictException);
  });

  it('counts a late answer as incorrect', () => {
    const { state } = startTrueOrMyth(mythConfig, T0, T0, noShuffle);
    const source = mythConfig.afirmaciones[state.statementIndexes[0]!]!;

    const outcome = answerTrueOrMyth(
      state,
      mythConfig,
      { position: 1, value: source.es_verdad },
      after(13),
    );

    expect(outcome.response).toMatchObject({ correct: false, timedOut: true });
  });
});
