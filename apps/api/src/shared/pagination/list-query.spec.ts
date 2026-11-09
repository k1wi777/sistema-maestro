import { createListQuerySchema, queryBoolean } from '@gns/shared';
import { z } from 'zod';

const schema = createListQuerySchema({
  sortFields: ['question', 'createdAt'],
  defaultSort: { field: 'createdAt', order: 'desc' },
  filters: { category: z.string().min(1).optional(), isActive: queryBoolean.optional() },
});

describe('createListQuerySchema', () => {
  it('aplica los valores por defecto', () => {
    expect(schema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      sort: { field: 'createdAt', order: 'desc' },
      filters: {},
    });
  });

  it('convierte texto a números y arma los filtros', () => {
    const result = schema.parse({
      page: '3',
      pageSize: '100',
      sortBy: 'question',
      sortOrder: 'asc',
      category: 'general',
      isActive: 'false',
    });
    expect(result).toEqual({
      page: 3,
      pageSize: 100,
      sort: { field: 'question', order: 'asc' },
      filters: { category: 'general', isActive: false },
    });
  });

  it.each([
    ['pageSize 0', { pageSize: '0' }],
    ['pageSize 101', { pageSize: '101' }],
    ['page 0', { page: '0' }],
    ['page negativa', { page: '-1' }],
    ['page decimal', { page: '1.5' }],
    ['sortBy no permitido', { sortBy: 'answer' }],
    ['sortOrder inválido', { sortOrder: 'up' }],
    ['parámetro desconocido', { other: 'x' }],
    ['booleano inválido', { isActive: 'yes' }],
  ])('rechaza %s', (_name, query) => {
    expect(schema.safeParse(query).success).toBe(false);
  });
});

describe('queryBoolean', () => {
  it('solo acepta "true" y "false"', () => {
    expect(queryBoolean.parse('true')).toBe(true);
    expect(queryBoolean.parse('false')).toBe(false);
    expect(queryBoolean.safeParse('1').success).toBe(false);
  });
});
