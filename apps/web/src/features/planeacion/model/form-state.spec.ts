import { buildPatch, dateRangeError, dirtyFields, mapApiErrors, toFormValues } from './form-state';
import { makePlan, makeValues } from './test-fixtures';

describe('form state', () => {
  it('maps a plan to text values with empty strings for missing data', () => {
    const values = toFormValues(makePlan({ socializationMoment: null, curiocityStage: null }));
    expect(values.socializationMoment).toBe('');
    expect(values.curiocityStage).toBe('');
    expect(values.topic).toBe('Sweet Home: my family');
    expect(values.periodId).toBe('33333333-3333-4333-8333-333333333333');
  });

  it('treats surrounding spaces and empty text as no change', () => {
    const saved = makeValues({ topic: 'Tema', closingMoment: '' });
    const draft = makeValues({ topic: '  Tema  ', closingMoment: '   ' });
    expect(dirtyFields(saved, draft)).toEqual([]);
    expect(buildPatch(saved, draft)).toEqual({ kind: 'unchanged' });
  });

  it('builds a patch with only the modified fields, trimmed, and empty as null', () => {
    const saved = makeValues({ topic: 'Tema', closingMoment: 'Cierre' });
    const draft = makeValues({ topic: ' Nuevo tema ', closingMoment: '' });
    const result = buildPatch(saved, draft);
    expect(result).toEqual({
      kind: 'patch',
      fields: ['topic', 'closingMoment'],
      body: { topic: 'Nuevo tema', closingMoment: null },
    });
  });

  it('clears a date with null and sends the curiocity stage as is', () => {
    const saved = makeValues({ dateFrom: '2026-11-02', curiocityStage: '' });
    const draft = makeValues({ dateFrom: '', curiocityStage: 'Creo' });
    expect(buildPatch(saved, draft)).toMatchObject({
      kind: 'patch',
      body: { dateFrom: null, curiocityStage: 'Creo' },
    });
  });

  it('rejects text over the maximum before sending', () => {
    const saved = makeValues();
    const draft = makeValues({ topic: 'x'.repeat(161) });
    const result = buildPatch(saved, draft);
    expect(result.kind).toBe('invalid');
    expect(result.kind === 'invalid' && result.errors.topic).toContain('160');
  });

  it('flags a final date before the initial one on the final date field', () => {
    const draft = makeValues({ dateFrom: '2026-11-06', dateTo: '2026-11-02' });
    expect(dateRangeError(draft)).toBe('La fecha final no puede ser anterior a la inicial.');
    const result = buildPatch(makeValues(), draft);
    expect(result.kind).toBe('invalid');
    expect(result.kind === 'invalid' && result.errors.dateTo).toBe(
      'La fecha final no puede ser anterior a la inicial.',
    );
    expect(dateRangeError(makeValues({ dateFrom: '2026-11-02', dateTo: '2026-11-02' }))).toBeNull();
  });

  it('maps API field errors to form fields and keeps the rest apart', () => {
    expect(
      mapApiErrors([
        { field: 'topic', reason: 'debe tener como máximo 160 caracteres' },
        { field: 'unknown', reason: 'otro motivo' },
      ]),
    ).toEqual({
      fields: { topic: 'debe tener como máximo 160 caracteres' },
      other: ['otro motivo'],
    });
    expect(mapApiErrors(undefined)).toEqual({ fields: {}, other: [] });
  });
});
