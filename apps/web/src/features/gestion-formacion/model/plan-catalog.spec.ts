import { buildPlanOptions, optionToParams, pickPlanOption } from './plan-catalog';
import { ID, planSummary } from './test-fixtures';

const areas = [
  { id: ID(20), name: 'Math' },
  { id: ID(10), name: 'English (CLIL)' },
  { id: ID(30), name: 'Ciencias' },
];

describe('buildPlanOptions', () => {
  const general = planSummary(1, { moduleCounts: { draft: 0, active: 9, outOfPlan: 0 } });
  const english = planSummary(2, {
    areaId: ID(10),
    areaName: 'English (CLIL)',
    name: 'Plan de formación · English (CLIL)',
    moduleCounts: { draft: 1, active: 0, outOfPlan: 0 },
  });

  it('pone el plan General primero y luego las áreas por nombre', () => {
    const options = buildPlanOptions([english, general], areas);
    expect(options.map((option) => option.label)).toEqual([
      'General · Inducción institucional',
      'Ciencias (sin módulos)',
      'English (CLIL) (1 módulo)',
      'Math (sin módulos)',
    ]);
  });

  it('un área sin plan es una opción sin plan que se identifica por el área', () => {
    const option = buildPlanOptions([general], areas).find((item) => item.area?.id === ID(20));
    expect(option?.plan).toBeNull();
    expect(option?.key).toBe(`area:${ID(20)}`);
    expect(option && optionToParams(option)).toEqual({ plan: null, area: ID(20) });
  });

  it('con varios planes de un área, cada uno es una opción con su año', () => {
    const second = planSummary(3, { areaId: ID(10), schoolYear: '2026-2027' });
    const first = planSummary(4, { areaId: ID(10), schoolYear: null });
    const labels = buildPlanOptions([second, first], [{ id: ID(10), name: 'English (CLIL)' }]).map(
      (option) => option.label,
    );
    expect(labels).toEqual([
      'English (CLIL) (0 módulos) · 2026-2027',
      'English (CLIL) (0 módulos) · todos los años',
    ]);
  });
});

describe('pickPlanOption', () => {
  const options = buildPlanOptions([planSummary(1), planSummary(2, { areaId: ID(10) })], areas);

  it('elige por plan, por área sin plan o la primera', () => {
    expect(pickPlanOption(options, { plan: ID(2), area: null })?.plan?.id).toBe(ID(2));
    expect(pickPlanOption(options, { plan: null, area: ID(20) })?.area?.id).toBe(ID(20));
    expect(pickPlanOption(options, { plan: 'otro', area: null })?.plan?.id).toBe(ID(1));
    expect(pickPlanOption([], { plan: null, area: null })).toBeNull();
  });

  it('un área que ya tiene plan también se elige por el parámetro de área', () => {
    expect(pickPlanOption(options, { plan: null, area: ID(10) })?.plan?.id).toBe(ID(2));
  });
});
