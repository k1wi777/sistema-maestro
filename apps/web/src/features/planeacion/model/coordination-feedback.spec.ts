import { adjustedFieldsLabel, latestFeedback } from './coordination-feedback';
import { makeReview } from './test-fixtures';

describe('coordination feedback', () => {
  it('returns null without a decision', () => {
    expect(latestFeedback([])).toBeNull();
    expect(latestFeedback([makeReview({ action: 'ajuste', comment: null })])).toBeNull();
  });

  it('takes the latest decision with its comment, reviewer and date', () => {
    const feedback = latestFeedback([
      makeReview({ comment: 'Antigua.', date: new Date('2026-10-01T15:00:00Z') }),
      makeReview({ comment: 'Reciente.', date: new Date('2026-11-05T15:00:00Z') }),
    ]);
    expect(feedback?.comment).toBe('Reciente.');
    expect(feedback?.reviewer).toBe('Coordinadora Demo');
    expect(feedback?.decision).toBe('observaciones');
  });

  it('collects the adjusted fields of rows with the same date and ignores older ones', () => {
    const date = new Date('2026-11-05T15:00:00Z');
    const feedback = latestFeedback([
      makeReview({
        action: 'ajuste',
        comment: null,
        date: new Date('2026-10-01T15:00:00Z'),
        adjustedFields: ['tema'],
      }),
      makeReview({
        action: 'ajuste',
        comment: null,
        date,
        adjustedFields: ['recursos', 'momento_cierre', 'columna_desconocida'],
      }),
      makeReview({ action: 'observaciones', date }),
    ]);
    expect(feedback?.adjustedFields.sort()).toEqual(['closingMoment', 'resources']);
    expect(adjustedFieldsLabel(feedback?.adjustedFields ?? [])).toContain('Recursos y materiales');
  });

  it('reports an approval as the decision', () => {
    const feedback = latestFeedback([makeReview({ action: 'aprobada', comment: null })]);
    expect(feedback?.decision).toBe('aprobada');
    expect(feedback?.comment).toBeNull();
  });
});
