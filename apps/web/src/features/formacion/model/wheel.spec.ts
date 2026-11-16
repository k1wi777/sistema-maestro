import { DATE } from './test-fixtures';
import { initialWheelState, pickCard, spinRotation, wheelReducer, type WheelState } from './wheel';

const cards = (n: number) => Array.from({ length: n }, (_, i) => ({ clave: `k${i}` }));
const fixed = (value: number) => () => value;

describe('pickCard', () => {
  it('chooses among cards without a stamp', () => {
    expect(pickCard(cards(4), ['k0', 'k2'], fixed(0))).toBe(1);
    expect(pickCard(cards(4), ['k0', 'k2'], fixed(0.99))).toBe(3);
  });

  it('chooses among all cards when the passport is complete', () => {
    expect(pickCard(cards(3), ['k0', 'k1', 'k2'], fixed(0))).toBe(0);
    expect(pickCard(cards(3), ['k0', 'k1', 'k2'], fixed(0.7))).toBe(2);
  });

  it('never goes out of range even with random close to one', () => {
    expect(pickCard(cards(5), [], fixed(0.999999))).toBe(4);
    expect(pickCard([], [], fixed(0.5))).toBe(-1);
  });
});

describe('spinRotation', () => {
  it('leaves the card center under the pointer when there is no jitter', () => {
    const count = 5;
    for (let index = 0; index < count; index += 1) {
      const total = spinRotation(0, index, count, fixed(0.5));
      const center = (index + 0.5) * (360 / count);

      expect((((total + center) % 360) + 360) % 360).toBeCloseTo(0, 6);
    }
  });

  it('always moves forward by whole turns from the current rotation', () => {
    const next = spinRotation(1234, 2, 6, fixed(0));

    expect(next).toBeGreaterThanOrEqual(1234 + 4 * 360);
  });

  it('stops inside the segment of the chosen card', () => {
    const count = 6;
    const size = 360 / count;
    for (const value of [0, 0.25, 0.99]) {
      const total = spinRotation(40, 3, count, fixed(value));
      const under = (((360 - (total % 360)) % 360) + 360) % 360;

      expect(under).toBeGreaterThanOrEqual(3 * size);
      expect(under).toBeLessThanOrEqual(4 * size);
    }
  });
});

describe('wheelReducer', () => {
  const spun = (stamps: string[] = []): WheelState => {
    const state = wheelReducer(initialWheelState(stamps), {
      type: 'spin',
      index: 1,
      key: 'k1',
      rotation: 900,
    });
    return wheelReducer(state, { type: 'spun' });
  };
  const result = { correct: true, correctIndex: 2, stamps: ['k1'], completedAt: DATE };

  it('goes from idle through spinning to the card', () => {
    const spinning = wheelReducer(initialWheelState([]), {
      type: 'spin',
      index: 1,
      key: 'k1',
      rotation: 900,
    });

    expect(spinning).toMatchObject({ phase: 'spinning', rotation: 900, card: { key: 'k1' } });
    expect(wheelReducer(spinning, { type: 'spun' }).phase).toBe('card');
  });

  it('does not spin again while spinning, answering or showing the question', () => {
    for (const phase of ['spinning', 'card', 'submitting'] as const) {
      const state = { ...spun(), phase };

      expect(wheelReducer(state, { type: 'spin', index: 0, key: 'k0', rotation: 1 })).toBe(state);
    }
  });

  it('sends one answer only: later choices are ignored', () => {
    const first = wheelReducer(spun(), { type: 'choose', optionIndex: 1 });
    const second = wheelReducer(first, { type: 'choose', optionIndex: 2 });

    expect(first).toMatchObject({ phase: 'submitting', chosen: 1, seq: 1 });
    expect(second).toBe(first);
  });

  it('shows the stamps the API returned', () => {
    const answering = wheelReducer(spun(), { type: 'choose', optionIndex: 2 });
    const done = wheelReducer(answering, { type: 'result', result });

    expect(done).toMatchObject({ phase: 'answered', stamps: ['k1'], alreadyStamped: false });
  });

  it('knows when a correct answer was on a card that already had its stamp', () => {
    const answering = wheelReducer(spun(['k1']), { type: 'choose', optionIndex: 2 });

    expect(answering.alreadyStamped).toBe(true);
  });

  it('ignores a result that arrives outside submitting', () => {
    const state = spun();

    expect(wheelReducer(state, { type: 'result', result })).toBe(state);
  });

  it('lets the teacher retry or spin again after a network failure', () => {
    const answering = wheelReducer(spun(), { type: 'choose', optionIndex: 0 });
    const failed = wheelReducer(answering, { type: 'failed', message: 'Sin red' });

    expect(failed).toMatchObject({ phase: 'error', errorMessage: 'Sin red' });
    expect(wheelReducer(failed, { type: 'retry' })).toMatchObject({ phase: 'submitting', seq: 2 });
    expect(wheelReducer(failed, { type: 'spin', index: 0, key: 'k0', rotation: 1800 }).phase).toBe(
      'spinning',
    );
  });

  it('reviews only a stamp already won and never during a question', () => {
    const idle = initialWheelState(['k0']);
    const reviewing = wheelReducer(idle, { type: 'review', key: 'k0' });

    expect(reviewing.review).toBe('k0');
    expect(wheelReducer(idle, { type: 'review', key: 'k9' }).review).toBeNull();
    const card = spun(['k0']);
    expect(wheelReducer(card, { type: 'review', key: 'k0' })).toBe(card);
    expect(wheelReducer(reviewing, { type: 'closeReview' }).review).toBeNull();
    expect(
      wheelReducer(reviewing, { type: 'spin', index: 0, key: 'k0', rotation: 1 }).review,
    ).toBeNull();
  });
});
