import { challengeKeyAction } from './challenge-keys';

describe('challengeKeyAction', () => {
  it('picks a tile with keys 1 to 4 in multiple choice', () => {
    const base = { phase: 'question', questionType: 'opcion', optionCount: 4 } as const;

    expect(challengeKeyAction({ ...base, key: '1' })).toEqual({ type: 'pick', index: 0 });
    expect(challengeKeyAction({ ...base, key: '4' })).toEqual({ type: 'pick', index: 3 });
    expect(challengeKeyAction({ ...base, key: '5' })).toBeNull();
    expect(challengeKeyAction({ ...base, key: '0' })).toBeNull();
  });

  it('ignores keys beyond the options that exist', () => {
    expect(
      challengeKeyAction({ key: '3', phase: 'question', questionType: 'opcion', optionCount: 2 }),
    ).toBeNull();
    expect(
      challengeKeyAction({ key: '2', phase: 'question', questionType: 'vf', optionCount: 2 }),
    ).toEqual({ type: 'pick', index: 1 });
  });

  it('places with 1 to 5, removes with Backspace and confirms with Enter only when complete', () => {
    const base = { phase: 'question', questionType: 'orden', optionCount: 5 } as const;

    expect(challengeKeyAction({ ...base, key: '5' })).toEqual({ type: 'place', index: 4 });
    expect(challengeKeyAction({ ...base, key: 'Backspace' })).toEqual({ type: 'unplaceLast' });
    expect(challengeKeyAction({ ...base, key: 'Enter', placedCount: 3 })).toBeNull();
    expect(challengeKeyAction({ ...base, key: 'Enter', placedCount: 5 })).toEqual({
      type: 'confirm',
    });
  });

  it('uses Enter to advance once the answer is graded', () => {
    expect(
      challengeKeyAction({
        key: 'Enter',
        phase: 'answered',
        questionType: 'opcion',
        optionCount: 4,
      }),
    ).toEqual({ type: 'advance' });
    expect(
      challengeKeyAction({ key: '1', phase: 'answered', questionType: 'opcion', optionCount: 4 }),
    ).toBeNull();
  });

  it('does nothing outside a question', () => {
    for (const phase of ['lobby', 'starting', 'submitting', 'loadingNext', 'finished'] as const) {
      expect(
        challengeKeyAction({ key: '1', phase, questionType: 'opcion', optionCount: 4 }),
      ).toBeNull();
    }
  });
});
