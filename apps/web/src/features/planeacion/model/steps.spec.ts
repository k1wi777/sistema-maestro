import type { LessonPlanAdjustableField } from '@gns/shared';

import {
  CONTENT_STEPS,
  FIELD_BY_COLUMN,
  STEPS,
  isStepId,
  neighbourStep,
  stepById,
  stepOfAdjustedField,
  stepOfFormField,
  stepState,
} from './steps';
import { makeValues } from './test-fixtures';

const NO_ADJUSTMENTS = new Set<LessonPlanAdjustableField>();

describe('steps', () => {
  it('defines the six steps in order', () => {
    expect(STEPS.map((step) => step.id)).toEqual([
      'datos',
      'desempeno',
      'momentos',
      'recursos',
      'digitales',
      'revisar',
    ]);
    expect(CONTENT_STEPS).toHaveLength(5);
  });

  it('validates step ids from the URL', () => {
    expect(isStepId('momentos')).toBe(true);
    expect(isStepId('otro')).toBe(false);
    expect(isStepId(null)).toBe(false);
  });

  it('finds the neighbours and stops at the ends', () => {
    expect(neighbourStep('datos', -1)).toBeNull();
    expect(neighbourStep('datos', 1)?.id).toBe('desempeno');
    expect(neighbourStep('revisar', 1)).toBeNull();
    expect(neighbourStep('revisar', -1)?.id).toBe('digitales');
  });

  it('reports empty, pending and done by the filled fields', () => {
    const general = stepById('datos');
    expect(stepState(general, makeValues(), NO_ADJUSTMENTS, 0)).toBe('empty');
    expect(stepState(general, makeValues({ topic: 'Tema' }), NO_ADJUSTMENTS, 0)).toBe('pending');
    expect(
      stepState(
        general,
        makeValues({ topic: 'Tema', dateFrom: '2026-11-02', dateTo: '2026-11-06' }),
        NO_ADJUSTMENTS,
        0,
      ),
    ).toBe('done');
  });

  it('does not count the corner or the stage for the moments step', () => {
    const moments = stepById('momentos');
    expect(
      stepState(moments, makeValues({ learningCorner: 'Sweet Home' }), NO_ADJUSTMENTS, 0),
    ).toBe('empty');
  });

  it('marks digital resources done with a link and empty without any', () => {
    const digital = stepById('digitales');
    expect(stepState(digital, makeValues(), NO_ADJUSTMENTS, 0)).toBe('empty');
    expect(stepState(digital, makeValues(), NO_ADJUSTMENTS, 2)).toBe('done');
  });

  it('marks a step adjusted when coordination changed one of its fields', () => {
    const adjusted = new Set<LessonPlanAdjustableField>(['closingMoment']);
    expect(stepState(stepById('momentos'), makeValues(), adjusted, 0)).toBe('adjusted');
    expect(stepState(stepById('datos'), makeValues(), adjusted, 0)).toBe('empty');
    const corner = new Set<LessonPlanAdjustableField>(['learningCorner']);
    expect(stepState(stepById('momentos'), makeValues(), corner, 0)).toBe('adjusted');
  });

  it('maps history columns back to API keys and fields to their step', () => {
    expect(FIELD_BY_COLUMN.momento_cierre).toBe('closingMoment');
    expect(FIELD_BY_COLUMN.desempeno_esperado).toBe('expectedPerformance');
    expect(stepOfAdjustedField('resources')).toBe('recursos');
    expect(stepOfAdjustedField('curiocityStage')).toBe('momentos');
  });

  it('finds the step where a form field is written', () => {
    expect(stepOfFormField('periodId')).toBe('datos');
    expect(stepOfFormField('areaIds')).toBe('datos');
    expect(stepOfFormField('topic')).toBe('datos');
    expect(stepOfFormField('developmentMoment')).toBe('momentos');
    expect(stepOfFormField('learningCorner')).toBe('momentos');
    expect(stepOfFormField('reasonableAdjustments')).toBe('recursos');
    expect(stepOfFormField('other')).toBeNull();
  });
});
