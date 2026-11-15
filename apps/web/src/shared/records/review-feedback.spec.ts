import type { Review } from '@gns/shared';

import { latestDecision } from './review-feedback';

const ID = '11111111-1111-4111-8111-111111111111';

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: ID,
    action: 'observaciones',
    comment: 'Agrega el cierre.',
    reviewer: { id: ID, fullName: 'Coordinadora Demo' },
    date: new Date('2026-11-05T15:00:00Z'),
    adjustedFields: [],
    changes: [],
    ...overrides,
  };
}

describe('latest decision', () => {
  it('returns null without a decision', () => {
    expect(latestDecision([])).toBeNull();
    expect(latestDecision([makeReview({ action: 'ajuste', comment: null })])).toBeNull();
  });

  it('takes the latest decision with its comment, reviewer and date', () => {
    const decision = latestDecision([
      makeReview({ comment: 'Antigua.', date: new Date('2026-10-01T15:00:00Z') }),
      makeReview({ comment: 'Reciente.' }),
    ]);
    expect(decision?.comment).toBe('Reciente.');
    expect(decision?.reviewer).toBe('Coordinadora Demo');
    expect(decision?.decision).toBe('observaciones');
  });

  it('collects the adjusted columns of rows with the same date and ignores older ones', () => {
    const date = new Date('2026-11-05T15:00:00Z');
    const decision = latestDecision([
      makeReview({
        action: 'ajuste',
        comment: null,
        date: new Date('2026-10-01T15:00:00Z'),
        adjustedFields: ['tema'],
      }),
      makeReview({ action: 'ajuste', comment: null, date, adjustedFields: ['recursos'] }),
      makeReview({ action: 'observaciones', date }),
    ]);
    expect(decision?.adjustedColumns).toEqual(['recursos']);
  });
});
