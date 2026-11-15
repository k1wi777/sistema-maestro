import { TeacherModuleState, TrainingActivityType } from '@gns/shared';

import { moduleChips, routeOverview } from './route';
import { DATE, makeActivitySummary, makeRoute, makeSummary, uuid } from './test-fixtures';

describe('routeOverview', () => {
  it('sums all plans and rounds the percentage', () => {
    const route = makeRoute([
      [makeSummary({ id: uuid(1), state: TeacherModuleState.Done }), makeSummary({ id: uuid(2) })],
      [makeSummary({ id: uuid(3) })],
    ]);

    expect(routeOverview(route)).toMatchObject({ total: 3, completed: 1, percent: 33 });
  });

  it('continues in the first module in progress following the route order', () => {
    const route = makeRoute([
      [makeSummary({ id: uuid(1), state: TeacherModuleState.Done })],
      [
        makeSummary({ id: uuid(2), number: '4', title: 'Cuatro', state: 'en_curso' }),
        makeSummary({ id: uuid(3), state: 'en_curso' }),
      ],
    ]);

    expect(routeOverview(route).continueModule).toEqual({ id: uuid(2), label: '4 · Cuatro' });
  });

  it('offers no continue link without a module in progress', () => {
    const route = makeRoute([[makeSummary({ state: TeacherModuleState.Pending })]]);

    expect(routeOverview(route).continueModule).toBeNull();
  });

  it('reports an empty route without dividing by zero', () => {
    expect(routeOverview(makeRoute([]))).toMatchObject({ isEmpty: true, total: 0, percent: 0 });
    expect(routeOverview(makeRoute([[]])).isEmpty).toBe(true);
  });
});

describe('moduleChips', () => {
  it('shows one chip per content the module has, in rule order', () => {
    const chips = moduleChips(
      makeSummary({
        steps: { video: true, presentation: true, challenge: true, activities: 2 },
        bestScore: 67,
        videoViewedAt: DATE,
        activities: [
          makeActivitySummary({ id: uuid(5), title: 'Conecta', bestScore: 85, completedAt: DATE }),
          makeActivitySummary({
            id: uuid(6),
            type: TrainingActivityType.WheelPassport,
            title: 'Ruleta',
            stamps: { done: 2, total: 5 },
          }),
        ],
      }),
    );

    expect(chips).toEqual([
      { key: 'video', label: 'Video', done: true },
      { key: 'challenge', label: 'Desafío GNS 67%', done: false },
      { key: 'presentation', label: 'Presentación', done: false },
      { key: uuid(5), label: 'Conecta 85%', done: true },
      { key: uuid(6), label: 'Pasaporte 2/5 sellos', done: false },
    ]);
  });

  it('shows only the content of a module with a single type', () => {
    const chips = moduleChips(
      makeSummary({ steps: { video: false, presentation: false, challenge: true, activities: 0 } }),
    );

    expect(chips).toEqual([{ key: 'challenge', label: 'Desafío GNS', done: false }]);
  });

  it('marks the challenge as done when the module is finished', () => {
    const chips = moduleChips(
      makeSummary({
        steps: { video: false, presentation: false, challenge: true, activities: 0 },
        bestScore: 90,
        completedAt: DATE,
      }),
    );

    expect(chips[0]).toMatchObject({ label: 'Desafío GNS 90%', done: true });
  });

  it('returns no chips for an empty module', () => {
    expect(moduleChips(makeSummary())).toEqual([]);
  });
});
