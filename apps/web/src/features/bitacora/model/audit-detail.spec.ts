import { NO_DATA, describeAuditData } from './audit-detail';

describe('describeAuditData', () => {
  it('arma filas con la unión de claves y valores anidados como JSON compacto', () => {
    const view = describeAuditData(
      { estado: 'borrador', n: 1 },
      { estado: 'enviada', extra: { a: 1 } },
    );
    expect(view).toEqual({
      kind: 'rows',
      missing: [],
      rows: [
        { field: 'estado', before: 'borrador', after: 'enviada' },
        { field: 'n', before: '1', after: null },
        { field: 'extra', before: null, after: '{"a":1}' },
      ],
    });
  });

  it('indica qué lado no tiene datos', () => {
    const view = describeAuditData(null, { estado: 'activo' });
    expect(view).toMatchObject({ kind: 'rows', missing: ['before'] });
  });

  it('muestra «Sin datos» cuando ambos son nulos', () => {
    expect(describeAuditData(null, null)).toEqual({
      kind: 'json',
      before: NO_DATA,
      after: NO_DATA,
    });
  });

  it('formatea como JSON lo que no es un objeto plano', () => {
    expect(describeAuditData([1, 2], 'texto')).toEqual({
      kind: 'json',
      before: '[\n  1,\n  2\n]',
      after: '"texto"',
    });
  });
});
