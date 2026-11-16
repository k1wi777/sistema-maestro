import {
  DATE_RANGE_MESSAGE,
  auditFiltersFromParams,
  auditFiltersKey,
  auditFiltersToQuery,
  dateRangeError,
  exportFileName,
  hasActiveAuditFilters,
} from './audit-filters';

const USER = '11111111-1111-4111-8111-111111111111';

function params(values: Record<string, string>) {
  return { get: (name: string) => values[name] ?? null };
}

describe('auditFiltersFromParams', () => {
  it('lee los filtros válidos', () => {
    expect(
      auditFiltersFromParams(
        params({
          userId: USER,
          role: 'docente',
          type: 'planeacion',
          from: '2026-11-01',
          to: '2026-11-09',
        }),
      ),
    ).toEqual({
      userId: USER,
      role: 'docente',
      type: 'planeacion',
      from: '2026-11-01',
      to: '2026-11-09',
    });
  });

  it('acepta el rol «desconocido» (sin sesión)', () => {
    expect(auditFiltersFromParams(params({ role: 'desconocido' })).role).toBe('desconocido');
  });

  it('ignora valores inválidos', () => {
    const filters = auditFiltersFromParams(
      params({ userId: 'x', role: 'rector', type: 'otro', from: '2026-02-30', to: 'ayer' }),
    );
    expect(hasActiveAuditFilters(filters)).toBe(false);
  });
});

describe('dateRangeError', () => {
  it('rechaza «hasta» anterior a «desde»', () => {
    expect(dateRangeError({ from: '2026-11-09', to: '2026-11-01' })).toBe(DATE_RANGE_MESSAGE);
  });

  it('acepta rangos del mismo día, abiertos o vacíos', () => {
    expect(dateRangeError({ from: '2026-11-09', to: '2026-11-09' })).toBeNull();
    expect(dateRangeError({ from: '2026-11-09' })).toBeNull();
    expect(dateRangeError({})).toBeNull();
  });
});

describe('auditFiltersToQuery y auditFiltersKey', () => {
  it('arma la query solo con los filtros con valor', () => {
    expect(auditFiltersToQuery({ userId: USER, type: undefined, from: '' })).toEqual({
      userId: USER,
    });
  });

  it('la clave cambia con cada filtro', () => {
    expect(auditFiltersKey({})).not.toBe(auditFiltersKey({ type: 'ingreso' }));
    expect(auditFiltersKey({ from: '2026-11-01' })).toBe(auditFiltersKey({ from: '2026-11-01' }));
  });
});

describe('exportFileName', () => {
  it('usa la fecha de Colombia', () => {
    // 02:00 UTC del día 10 sigue siendo el 9 en Colombia (UTC−5).
    expect(exportFileName(new Date('2026-11-10T02:00:00Z'))).toBe('bitacora-2026-11-09.csv');
  });
});
