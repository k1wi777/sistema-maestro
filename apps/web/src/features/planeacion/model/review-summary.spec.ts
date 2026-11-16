import type { LessonPlanAdjustableField } from '@gns/shared';

import { buildReviewSummary, type SummaryContext } from './review-summary';
import { makeValues } from './test-fixtures';

const context: SummaryContext = {
  gradeName: 'Transition',
  areaNames: 'English (CLIL)',
  periodNumber: 1,
  linkCount: 0,
  adjusted: new Set<LessonPlanAdjustableField>(),
};

const COMPLETE = makeValues({
  dateFrom: '2026-11-02',
  dateTo: '2026-11-06',
  topic: 'Tema',
  expectedPerformance: 'Presenta a su familia.',
  explorationMoment: 'a',
  developmentMoment: 'b',
  socializationMoment: 'c',
  closingMoment: 'd',
  resources: 'e',
  reasonableAdjustments: 'f',
});

describe('review summary', () => {
  it('blocks the submission when the required fields are missing', () => {
    const summary = buildReviewSummary(makeValues(), context);
    expect(summary.blocking.map((error) => error.field)).toEqual([
      'expectedPerformance',
      'developmentMoment',
    ]);
    expect(summary.blockedReason).toBe(
      'Completa el desempeño esperado y el Momento 2 · Desarrollo para poder enviarla.',
    );
  });

  it('does not block when only optional content is missing, but flags it', () => {
    const values = makeValues({
      expectedPerformance: 'Desempeño',
      developmentMoment: 'Desarrollo',
    });
    const summary = buildReviewSummary(values, context);
    expect(summary.blocking).toEqual([]);
    expect(summary.blockedReason).toBeNull();
    const moments = summary.items.find((item) => item.id === 'momentos');
    expect(moments?.complete).toBe(false);
    expect(moments?.detail).toContain('Momento 1 · Exploración');
    expect(moments?.detail).not.toContain('obligatorio');
  });

  it('says the development moment is required when it is missing', () => {
    const summary = buildReviewSummary(makeValues({ expectedPerformance: 'x' }), context);
    const moments = summary.items.find((item) => item.id === 'momentos');
    expect(moments?.detail).toContain('el Momento 2 es obligatorio para enviar');
  });

  it('summarises a complete plan with the general data', () => {
    const summary = buildReviewSummary(COMPLETE, { ...context, linkCount: 2 });
    expect(summary.items.every((item) => item.complete)).toBe(true);
    expect(summary.items[0]?.detail).toBe(
      'Transition · English (CLIL) · Periodo 1 · 2 nov – 6 nov.',
    );
    expect(summary.items.find((item) => item.id === 'digitales')?.detail).toBe(
      '2 recursos enlazados.',
    );
  });

  it('names what coordination adjusted in each step', () => {
    const adjusted = new Set<LessonPlanAdjustableField>(['resources']);
    const summary = buildReviewSummary(COMPLETE, { ...context, adjusted });
    expect(summary.items.find((item) => item.id === 'recursos')?.detail).toContain(
      'Coordinación ajustó: Recursos y materiales.',
    );
  });
});
