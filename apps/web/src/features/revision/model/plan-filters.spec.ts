import {
  hasActiveFilters,
  planFiltersFromParams,
  planFiltersKey,
  planFiltersToQuery,
  withoutStatus,
} from './plan-filters';
import { UUID_A, UUID_B } from './test-fixtures';

const params = (entries: Record<string, string>) => ({
  get: (name: string) => entries[name] ?? null,
});

describe('planFiltersFromParams', () => {
  it('lee estado e ids válidos de la URL', () => {
    expect(
      planFiltersFromParams(params({ status: 'enviada', gradeId: UUID_A, teacherId: UUID_B })),
    ).toEqual({
      status: 'enviada',
      gradeId: UUID_A,
      areaId: undefined,
      periodId: undefined,
      teacherId: UUID_B,
    });
  });

  it('ignora un estado o un id que no son válidos', () => {
    const filters = planFiltersFromParams(
      params({ status: 'hackeado', areaId: 'x', periodId: '1' }),
    );
    expect(filters).toEqual({
      status: undefined,
      gradeId: undefined,
      areaId: undefined,
      periodId: undefined,
      teacherId: undefined,
    });
    expect(hasActiveFilters(filters)).toBe(false);
  });
});

describe('filtros derivados', () => {
  it('withoutStatus conserva el resto de filtros para los indicadores', () => {
    expect(withoutStatus({ status: 'enviada', gradeId: UUID_A })).toEqual({
      status: undefined,
      gradeId: UUID_A,
    });
  });

  it('la clave cambia con cualquier filtro', () => {
    const base = planFiltersKey({});
    expect(planFiltersKey({ status: 'enviada' })).not.toBe(base);
    expect(planFiltersKey({ teacherId: UUID_A })).not.toBe(planFiltersKey({ gradeId: UUID_A }));
    expect(hasActiveFilters({ status: 'revisada' })).toBe(true);
  });
});

describe('planFiltersToQuery', () => {
  it('serializa solo los filtros activos y el resultado se lee de vuelta', () => {
    const query = planFiltersToQuery({ status: 'enviada', teacherId: UUID_B });
    expect(query).toBe(`status=enviada&teacherId=${UUID_B}`);
    expect(planFiltersFromParams(new URLSearchParams(query))).toMatchObject({
      status: 'enviada',
      teacherId: UUID_B,
    });
    expect(planFiltersToQuery({})).toBe('');
  });
});
