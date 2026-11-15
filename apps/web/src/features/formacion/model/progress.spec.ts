import { progressRows, routeCertificate } from './progress';
import {
  DATE,
  makeActivitySummary,
  makeCertificate,
  makeRoute,
  makeSummary,
  uuid,
} from './test-fixtures';

describe('progressRows', () => {
  it('builds one row per module with not-applicable cells from the steps', () => {
    const route = makeRoute([
      [
        makeSummary({
          id: uuid(1),
          number: '7',
          title: 'Talento',
          steps: { video: false, presentation: false, challenge: true, activities: 0 },
        }),
      ],
    ]);

    expect(progressRows(route, [])).toEqual([
      {
        moduleId: uuid(1),
        planName: 'Plan 1',
        title: '7 · Talento',
        video: 'not_applicable',
        challenge: { kind: 'score', score: null },
        presentation: 'not_applicable',
        requiredDone: 0,
        requiredTotal: 0,
        state: 'pendiente',
        certificateId: null,
      },
    ]);
  });

  it('reads viewed state, score and required activities and matches the certificate by module', () => {
    const route = makeRoute([
      [
        makeSummary({
          id: uuid(1),
          state: 'terminado',
          steps: { video: true, presentation: true, challenge: true, activities: 3 },
          videoViewedAt: DATE,
          bestScore: 90,
          activities: [
            makeActivitySummary({ id: uuid(5), isRequired: true, completedAt: DATE }),
            makeActivitySummary({ id: uuid(6), isRequired: true }),
            makeActivitySummary({ id: uuid(7), isRequired: false }),
          ],
        }),
      ],
    ]);

    const [row] = progressRows(route, [
      makeCertificate({ id: uuid(301), moduleId: uuid(1) }),
      makeCertificate({ id: uuid(302), kind: 'ruta', moduleId: null }),
    ]);

    expect(row).toMatchObject({
      video: 'viewed',
      presentation: 'pending',
      challenge: { kind: 'score', score: 90 },
      requiredDone: 1,
      requiredTotal: 2,
      certificateId: uuid(301),
    });
  });

  it('does not rely on titles to match certificates', () => {
    const route = makeRoute([[makeSummary({ id: uuid(1), title: 'Renombrado' })]]);

    const [row] = progressRows(route, [
      makeCertificate({ moduleId: uuid(99), title: 'Renombrado' }),
    ]);

    expect(row?.certificateId).toBeNull();
  });
});

describe('routeCertificate', () => {
  it('returns how many modules are missing while there is no route certificate', () => {
    const route = makeRoute([
      [makeSummary({ id: uuid(1), state: 'terminado' }), makeSummary({ id: uuid(2) })],
    ]);

    expect(routeCertificate(route, [makeCertificate()])).toEqual({ certificate: null, missing: 1 });
  });

  it('returns the route certificate once issued', () => {
    const route = makeRoute([[makeSummary({ state: 'terminado' })]]);
    const certificate = makeCertificate({ kind: 'ruta', moduleId: null });

    expect(routeCertificate(route, [certificate])).toEqual({ certificate, missing: 0 });
  });
});
