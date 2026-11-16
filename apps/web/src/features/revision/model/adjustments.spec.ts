import {
  buildChanges,
  effectiveValue,
  formValueOf,
  isAdjusted,
  validateAdjustment,
} from './adjustments';
import { planSections } from './plan-blocks';
import { makePlan } from './test-fixtures';

const PLAN = makePlan({ topic: 'Tema original', closingMoment: null });
const blocks = planSections('Primaria').flatMap((section) => section.blocks);
const block = (key: string) => blocks.find((candidate) => candidate.key === key)!;

describe('buildChanges', () => {
  it('solo incluye los campos que difieren y vacía los textos con null', () => {
    expect(
      buildChanges(PLAN, {
        topic: 'Tema original',
        closingMoment: ' Cierre nuevo ',
        resources: '',
      }),
    ).toEqual({ closingMoment: 'Cierre nuevo', resources: null });
  });

  it('un campo sin valor ajustado a vacío tampoco cambia', () => {
    expect(buildChanges(PLAN, { closingMoment: '   ' })).toBeNull();
    expect(buildChanges(PLAN, {})).toBeNull();
  });
});

describe('valores vigentes', () => {
  it('el ajuste pendiente manda sobre el valor de la planeación', () => {
    expect(formValueOf(PLAN, 'closingMoment')).toBe('');
    expect(effectiveValue(PLAN, { topic: 'Otro' }, 'topic')).toBe('Otro');
    expect(effectiveValue(PLAN, {}, 'topic')).toBe('Tema original');
    expect(isAdjusted(PLAN, { topic: 'Otro' }, 'topic')).toBe(true);
    expect(isAdjusted(PLAN, { topic: 'Tema original' }, 'topic')).toBe(false);
    expect(isAdjusted(PLAN, {}, 'topic')).toBe(false);
  });
});

describe('validateAdjustment', () => {
  it('acepta un texto válido y un vacío', () => {
    expect(validateAdjustment(PLAN, {}, block('topic'), { topic: 'Nuevo tema' })).toBeNull();
    expect(validateAdjustment(PLAN, {}, block('topic'), { topic: '' })).toBeNull();
  });

  it('rechaza un texto que excede el máximo del esquema compartido', () => {
    expect(validateAdjustment(PLAN, {}, block('topic'), { topic: 'x'.repeat(161) })).toBe(
      'Debe tener como máximo 160 caracteres.',
    );
  });

  it('rechaza una fecha que no es AAAA-MM-DD y una etapa no permitida', () => {
    expect(
      validateAdjustment(PLAN, {}, block('dates'), {
        dateFrom: '02/11/2026',
        dateTo: '2026-11-06',
      }),
    ).toMatch(/fecha/iu);
    expect(
      validateAdjustment(
        PLAN,
        {},
        { fields: ['curiocityStage'], label: 'Etapa' },
        { curiocityStage: 'Otra' },
      ),
    ).toMatch(/etapa/iu);
  });

  it('la fecha final no puede ser anterior a la de inicio', () => {
    expect(
      validateAdjustment(PLAN, {}, block('dates'), {
        dateFrom: '2026-11-10',
        dateTo: '2026-11-06',
      }),
    ).toBe('La fecha final no puede ser anterior a la de inicio.');
    expect(
      validateAdjustment(PLAN, {}, block('dates'), {
        dateFrom: '2026-11-02',
        dateTo: '2026-11-06',
      }),
    ).toBeNull();
  });
});
