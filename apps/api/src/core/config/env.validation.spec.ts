import { validateEnv } from './env.validation';

const DATABASE_URL = 'postgresql://gns:gns@localhost:5432/gns';
const DATABASE_URL_REASON =
  '- DATABASE_URL: debe ser una URL de PostgreSQL (postgresql://usuario:clave@host:puerto/base)';

function errorMessageOf(config: Record<string, unknown>): string {
  try {
    validateEnv(config);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('validateEnv no lanzó ningún error');
}

describe('validateEnv', () => {
  it('returns the typed configuration when every variable is valid', () => {
    expect(validateEnv({ NODE_ENV: 'development', PORT: '3000', DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
    });
  });

  it('reports a missing PORT', () => {
    expect(errorMessageOf({ NODE_ENV: 'test', DATABASE_URL })).toContain(
      '- PORT: falta la variable',
    );
  });

  it('reports a non numeric PORT with its reason', () => {
    expect(errorMessageOf({ NODE_ENV: 'test', PORT: 'abc', DATABASE_URL })).toContain(
      '- PORT: debe ser un entero entre 1 y 65535',
    );
  });

  it('reports a PORT out of range', () => {
    expect(errorMessageOf({ NODE_ENV: 'test', PORT: '70000', DATABASE_URL })).toContain(
      '- PORT: debe ser un entero entre 1 y 65535',
    );
  });

  it('reports an invalid NODE_ENV', () => {
    expect(errorMessageOf({ NODE_ENV: 'staging', PORT: '3000', DATABASE_URL })).toContain(
      '- NODE_ENV: debe ser development, test o production',
    );
  });

  it('lists every missing variable in a single message', () => {
    const message = errorMessageOf({});
    expect(message).toContain('- NODE_ENV: falta la variable');
    expect(message).toContain('- PORT: falta la variable');
    expect(message).toContain('- DATABASE_URL: falta la variable');
  });

  it('accepts the postgres:// protocol in DATABASE_URL', () => {
    const url = 'postgres://gns:gns@localhost:5432/gns';
    expect(validateEnv({ NODE_ENV: 'test', PORT: '3000', DATABASE_URL: url }).DATABASE_URL).toBe(
      url,
    );
  });

  it('reports a DATABASE_URL that is not a URL', () => {
    expect(errorMessageOf({ NODE_ENV: 'test', PORT: '3000', DATABASE_URL: 'gns' })).toContain(
      DATABASE_URL_REASON,
    );
  });

  it('reports a DATABASE_URL with a protocol other than PostgreSQL', () => {
    expect(
      errorMessageOf({
        NODE_ENV: 'test',
        PORT: '3000',
        DATABASE_URL: 'mysql://gns:gns@localhost:3306/gns',
      }),
    ).toContain(DATABASE_URL_REASON);
  });

  it('never prints the values it received', () => {
    const message = errorMessageOf({
      NODE_ENV: 's3cr3t-value',
      PORT: 'abc',
      DATABASE_URL: 'mysql://gns:s3cr3t-password@localhost/gns',
    });
    expect(message).not.toContain('s3cr3t-value');
    expect(message).not.toContain('abc');
    expect(message).not.toContain('s3cr3t-password');
  });
});
