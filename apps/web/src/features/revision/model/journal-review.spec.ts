import {
  buildReturnBody,
  nextPending,
  observationCountLabel,
  pendingQueue,
  queuePosition,
} from './journal-review';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const ANNOTATION = '44444444-4444-4444-8444-444444444444';

describe('journal review queue', () => {
  it('keeps only submitted journals, in the order of the inbox', () => {
    expect(
      pendingQueue([
        { id: A, status: 'enviado' },
        { id: B, status: 'revisado' },
        { id: C, status: 'enviado' },
      ]),
    ).toEqual([A, C]);
  });

  it('tells the position in the queue', () => {
    expect(queuePosition([A, B, C], B)).toEqual({ index: 2, total: 3 });
    expect(queuePosition([A, C], B)).toBeNull();
  });

  it('moves to the next pending journal and wraps around', () => {
    expect(nextPending([A, B, C], A)).toBe(B);
    expect(nextPending([A, B, C], C)).toBe(A);
    expect(nextPending([A], A)).toBeNull();
    expect(nextPending([A, B], C)).toBe(A);
  });
});

describe('return body', () => {
  it('counts observations in singular and plural', () => {
    expect(observationCountLabel(1)).toBe('1 observación');
    expect(observationCountLabel(3)).toBe('3 observaciones');
  });

  it('asks for at least one observation, general or about an annotation', () => {
    const built = buildReturnBody('  ', { [ANNOTATION]: '  ' });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.message).toMatch(/observación/);
    }
  });

  it('builds the body with the filled observations and the general one', () => {
    const built = buildReturnBody('Revisen la fecha', {
      [ANNOTATION]: 'Amplía la descripción',
      [A]: '',
    });
    expect(built).toEqual({
      ok: true,
      data: {
        comment: 'Revisen la fecha',
        observations: [{ annotationId: ANNOTATION, text: 'Amplía la descripción' }],
      },
    });
    expect(buildReturnBody('', { [ANNOTATION]: 'Solo esta' }).ok).toBe(true);
  });
});
