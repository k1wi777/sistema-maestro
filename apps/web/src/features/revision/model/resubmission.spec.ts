import { reviewableBlocks } from './plan-blocks';
import { findResubmission } from './resubmission';
import { makePlan, makeReview } from './test-fixtures';

const BLOCKS = reviewableBlocks('Primaria');
const RETURNED = new Date('2026-11-04T15:00:00Z');
const RESUBMITTED = new Date('2026-11-07T15:00:00Z');

const returned = makeReview({
  action: 'observaciones',
  date: RETURNED,
  comment: 'Momento 2 · Desarrollo: Indica el tiempo.\n\nObservación general: Casi listo.',
});

describe('findResubmission', () => {
  it('devuelve las fechas y la observación previa de cada bloque', () => {
    const result = findResubmission(makePlan({ submittedAt: RESUBMITTED }), [returned], BLOCKS);
    expect(result).toMatchObject({
      returnedAt: RETURNED,
      resubmittedAt: RESUBMITTED,
      reviewer: 'Coordinadora Demo',
      observations: { developmentMoment: 'Indica el tiempo.' },
      general: 'Casi listo.',
      changedBlocks: [],
    });
  });

  it('marca el bloque ajustado cuyo valor actual difiere del ajustado', () => {
    const adjustment = makeReview({
      action: 'ajuste',
      date: RETURNED,
      adjustedFields: ['momento_cierre', 'recursos'],
      changes: [
        { field: 'momento_cierre', before: 'Antes', after: 'Cierre con juego.' },
        { field: 'recursos', before: 'Antes', after: 'Otros recursos' },
      ],
    });
    const result = findResubmission(
      makePlan({
        submittedAt: RESUBMITTED,
        closingMoment: 'Cierre nuevo.',
        resources: 'Otros recursos',
      }),
      [adjustment, returned],
      BLOCKS,
    );
    expect(result?.changedBlocks).toEqual(['closingMoment']);
  });

  it('las filas sin valores guardados no marcan nada', () => {
    const adjustment = makeReview({
      action: 'ajuste',
      date: RETURNED,
      adjustedFields: ['momento_cierre'],
      changes: [],
    });
    const result = findResubmission(
      makePlan({ submittedAt: RESUBMITTED }),
      [adjustment, returned],
      BLOCKS,
    );
    expect(result?.changedBlocks).toEqual([]);
  });

  it('no hay reenvío si la planeación no está enviada, si nunca se devolvió o si se envió antes', () => {
    expect(findResubmission(makePlan({ status: 'observaciones' }), [returned], BLOCKS)).toBeNull();
    expect(findResubmission(makePlan({ submittedAt: RESUBMITTED }), [], BLOCKS)).toBeNull();
    expect(
      findResubmission(
        makePlan({ submittedAt: new Date('2026-11-03T15:00:00Z') }),
        [returned],
        BLOCKS,
      ),
    ).toBeNull();
  });

  it('no hay reenvío si la última decisión fue una aprobación', () => {
    const approved = makeReview({ action: 'aprobada', date: new Date('2026-11-05T15:00:00Z') });
    expect(
      findResubmission(makePlan({ submittedAt: RESUBMITTED }), [returned, approved], BLOCKS),
    ).toBeNull();
  });
});
