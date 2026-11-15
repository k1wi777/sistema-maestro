import {
  EMPTY_ACTIVITY_FORM,
  activityToFormValues,
  buildCreateBody,
  buildUpdateBody,
  type ActivityFormValues,
} from './activity-form';
import { makeActivity } from './test-fixtures';

const GRADE = '33333333-3333-4333-8333-333333333333';
const LEVEL = '11111111-1111-4111-8111-111111111111';
const AREA = '22222222-2222-4222-8222-222222222222';

const valid: ActivityFormValues = {
  ...EMPTY_ACTIVITY_FORM,
  title: ' Ruleta ',
  steps: '1. Girar.',
};

describe('activity form: create', () => {
  it('builds a minimal body with the default type and trims the text', () => {
    expect(buildCreateBody(valid)).toEqual({
      kind: 'body',
      body: { title: 'Ruleta', steps: '1. Girar.', activityType: 'actividad' },
    });
  });

  it('sends the grade without the level, and the level alone for the whole level', () => {
    const withGrade = buildCreateBody({ ...valid, levelId: LEVEL, gradeId: GRADE, areaId: AREA });
    expect(withGrade).toMatchObject({ kind: 'body', body: { gradeId: GRADE, areaId: AREA } });
    expect(withGrade.kind === 'body' && withGrade.body).not.toHaveProperty('levelId');
    const wholeLevel = buildCreateBody({ ...valid, levelId: LEVEL });
    expect(wholeLevel).toMatchObject({ kind: 'body', body: { levelId: LEVEL } });
    expect(wholeLevel.kind === 'body' && wholeLevel.body).not.toHaveProperty('gradeId');
  });

  it('parses the duration and rejects what is not a number', () => {
    expect(buildCreateBody({ ...valid, durationMinutes: '30' })).toMatchObject({
      body: { durationMinutes: 30 },
    });
    expect(buildCreateBody({ ...valid, durationMinutes: 'abc' })).toEqual({
      kind: 'invalid',
      errors: { durationMinutes: 'Escribe un número de minutos.' },
    });
  });

  it('reports the required fields and the link rule on their fields', () => {
    const result = buildCreateBody({ ...EMPTY_ACTIVITY_FORM, link: 'javascript:alert(1)' });
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.errors.title).toBeDefined();
      expect(result.errors.steps).toBeDefined();
      expect(result.errors.link).toBeDefined();
    }
  });

  it('rejects a corner over 60 characters', () => {
    const result = buildCreateBody({ ...valid, learningCorner: 'r'.repeat(61) });
    expect(result.kind === 'invalid' && result.errors.learningCorner).toContain('60');
  });
});

describe('activity form: update', () => {
  const original = activityToFormValues(makeActivity({ durationMinutes: 30 }));

  it('maps an activity into the form values', () => {
    expect(original.gradeId).toBe(GRADE);
    expect(original.durationMinutes).toBe('30');
    expect(original.activityType).toBe('juego');
    expect(activityToFormValues(makeActivity({ grade: null })).gradeId).toBe('');
  });

  it('reports no change when nothing was modified', () => {
    expect(buildUpdateBody(original, { ...original, title: ` ${original.title} ` })).toEqual({
      kind: 'unchanged',
    });
  });

  it('sends only what changed and never a null type', () => {
    const result = buildUpdateBody(original, { ...original, title: 'Nuevo', materials: '' });
    expect(result).toEqual({ kind: 'body', body: { title: 'Nuevo', materials: null } });
    expect(result.kind === 'body' && result.body).not.toHaveProperty('activityType');
  });

  it('sends the type only when it changed', () => {
    expect(buildUpdateBody(original, { ...original, activityType: 'video' })).toEqual({
      kind: 'body',
      body: { activityType: 'video' },
    });
  });

  it('sends only the grade when a grade is chosen', () => {
    const other = '44444444-4444-4444-8444-444444444444';
    expect(buildUpdateBody(original, { ...original, gradeId: other })).toEqual({
      kind: 'body',
      body: { gradeId: other },
    });
  });

  it('sends a null grade together with the level for the whole level', () => {
    expect(buildUpdateBody(original, { ...original, gradeId: '' })).toEqual({
      kind: 'body',
      body: { gradeId: null, levelId: original.levelId },
    });
  });
});
