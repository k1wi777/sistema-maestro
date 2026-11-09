import { describeDatabaseError, mapPrismaError } from './prisma-error.mapper';

const prismaError = (code: string, meta?: unknown) =>
  Object.assign(new Error('Invalid `prisma.user.create()` invocation: email = secreto@x.test'), {
    code,
    meta,
  });

const checkViolation = (sqlState: string) =>
  prismaError('P2039', { driverAdapterError: { cause: { originalCode: sqlState } } });

describe('mapPrismaError', () => {
  it.each([
    ['P2002', 409, 'conflicto'],
    ['P2003', 409, 'conflicto'],
    ['P2025', 404, 'no_encontrado'],
  ])('maps %s to %i', (code, statusCode, apiCode) => {
    expect(mapPrismaError(prismaError(code))).toMatchObject({ statusCode, code: apiCode });
  });

  it('maps a CHECK violation (23514) to 400', () => {
    expect(mapPrismaError(checkViolation('23514'))).toMatchObject({
      statusCode: 400,
      code: 'validacion',
    });
  });

  it.each([
    ['another SQLSTATE under P2039', checkViolation('P0001')],
    ['P2039 without driver detail', prismaError('P2039')],
    ['an unmapped Prisma code', prismaError('P2024')],
    ['a plain error', new Error('boom')],
    ['a non error', 'text'],
    ['null', null],
  ])('returns null for %s so it becomes a 500', (_name, error) => {
    expect(mapPrismaError(error)).toBeNull();
  });

  it('never leaks the engine message, tables, columns or values', () => {
    const mapped = mapPrismaError(prismaError('P2002', { target: ['correo'], modelName: 'User' }));
    const text = JSON.stringify(mapped);
    expect(text).not.toMatch(/secreto|correo|User|invocation/);
  });
});

describe('describeDatabaseError', () => {
  it('returns only the Prisma code and the SQLSTATE', () => {
    expect(describeDatabaseError(checkViolation('23514'))).toEqual({
      prismaCode: 'P2039',
      sqlState: '23514',
    });
    expect(describeDatabaseError(prismaError('P2002'))).toEqual({ prismaCode: 'P2002' });
    expect(describeDatabaseError(new Error('x'))).toBeNull();
  });
});
