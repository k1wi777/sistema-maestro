import { emptyPair, initialMatchForm, matchFromForm, pairsNeeded } from './match-form';
import {
  emptyStatement,
  initialTrueOrMythForm,
  perGameHint,
  trueOrMythFromForm,
} from './true-or-myth-form';

describe('pairsNeeded', () => {
  it('compares pairs per round × rounds with the pairs written', () => {
    const form = initialMatchForm();
    expect(pairsNeeded(form)).toEqual({ needed: 10, have: 2, enough: false });
    const full = { ...form, pairs: Array.from({ length: 10 }, emptyPair) };
    expect(pairsNeeded(full)).toEqual({ needed: 10, have: 10, enough: true });
  });

  it('does not require anything while the numbers are not valid', () => {
    const form = { ...initialMatchForm(), perRound: 'x' };
    expect(pairsNeeded(form)).toEqual({ needed: null, have: 2, enough: true });
    expect(pairsNeeded({ ...initialMatchForm(), rounds: '' }).needed).toBeNull();
  });
});

describe('matchFromForm', () => {
  it('omits the icon when there is none and sends empty numbers as invalid', () => {
    const form = {
      ...initialMatchForm(),
      pairs: [{ concept: ' A ', fact: 'B', emoji: undefined }],
      seconds: '',
    };
    const candidate = matchFromForm(form) as {
      pares: Record<string, unknown>[];
      segundos_por_ronda: number;
    };
    expect(candidate.pares[0]).toEqual({ concepto: 'A', dato: 'B' });
    expect(candidate.segundos_por_ronda).toBeNaN();
  });
});

describe('true or myth form', () => {
  it('warns when the game asks for more statements than written', () => {
    expect(perGameHint(initialTrueOrMythForm())).toBe(
      'La partida pide 10 afirmaciones y solo hay 1 escritas.',
    );
    const enough = {
      ...initialTrueOrMythForm(),
      statements: Array.from({ length: 10 }, emptyStatement),
    };
    expect(perGameHint(enough)).toBeNull();
  });

  it('builds the candidate with the answer as a boolean', () => {
    const candidate = trueOrMythFromForm({
      ...initialTrueOrMythForm(),
      statements: [{ text: ' T ', isTrue: false, explanation: ' E ' }],
    }) as { afirmaciones: unknown[]; vidas: number };
    expect(candidate.afirmaciones).toEqual([{ texto: 'T', es_verdad: false, explicacion: 'E' }]);
    expect(candidate.vidas).toBe(3);
  });
});
