import { adjustedBlockDates, buildHistory } from './history';
import { makeReview } from './test-fixtures';

const T1 = new Date('2026-11-02T15:00:00Z');
const T2 = new Date('2026-11-04T15:00:00Z');
const T3 = new Date('2026-11-07T15:00:00Z');

describe('buildHistory', () => {
  it('ordena del más reciente al más antiguo e incluye el último envío', () => {
    const lines = buildHistory(
      [
        makeReview({ id: 'a', action: 'observaciones', date: T2, comment: 'Ajusta el cierre.' }),
        makeReview({ id: 'b', action: 'aprobada', date: T1, comment: null }),
      ],
      T3,
    );
    expect(lines.map((line) => line.kind)).toEqual(['submitted', 'returned', 'approved']);
    expect(lines[0]?.reviewer).toBeNull();
    expect(lines[1]).toMatchObject({ reviewer: 'Coordinadora Demo', comment: 'Ajusta el cierre.' });
  });

  it('junta a cada decisión los campos que se ajustaron con la misma fecha', () => {
    const lines = buildHistory(
      [
        makeReview({
          id: 'adj',
          action: 'ajuste',
          date: T2,
          adjustedFields: ['momento_cierre', 'recursos'],
        }),
        makeReview({ id: 'dec', action: 'observaciones', date: T2 }),
      ],
      null,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      kind: 'returned',
      adjusted: ['Momento 4 · Cierre', 'Recursos y materiales'],
    });
  });

  it('un ajuste sin decisión es una línea propia y las columnas desconocidas se ignoran', () => {
    const lines = buildHistory(
      [
        makeReview({
          id: 'adj',
          action: 'ajuste',
          date: T1,
          adjustedFields: ['tema', 'desconocida'],
        }),
      ],
      null,
    );
    expect(lines).toEqual([
      expect.objectContaining({ kind: 'adjusted', adjusted: ['Proyecto o tema'] }),
    ]);
  });

  it('sin historial ni envío no hay líneas', () => {
    expect(buildHistory([], null)).toEqual([]);
  });
});

describe('adjustedBlockDates', () => {
  it('guarda la fecha más reciente por bloque y junta las dos fechas en un bloque', () => {
    const dates = adjustedBlockDates([
      makeReview({ action: 'ajuste', date: T1, adjustedFields: ['fecha_desde', 'momento_cierre'] }),
      makeReview({ action: 'ajuste', date: T2, adjustedFields: ['fecha_hasta'] }),
    ]);
    expect(dates.dates).toEqual(T2);
    expect(dates.closingMoment).toEqual(T1);
    expect(dates.topic).toBeUndefined();
  });
});
