import { validateEnv } from './env.validation';

const DATABASE_URL = 'postgresql://gns:gns@localhost:5432/gns';
const CORS_ORIGINS = 'http://localhost:3001';
const BASE = { NODE_ENV: 'test', PORT: '3000', DATABASE_URL, CORS_ORIGINS };
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
    expect(validateEnv({ ...BASE, NODE_ENV: 'development' })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
      CORS_ORIGINS: [CORS_ORIGINS],
      RATE_LIMIT_WINDOW_SECONDS: 60,
      RATE_LIMIT_MAX_REQUESTS: 100,
      LOG_LEVEL: 'info',
    });
  });

  it('reports a missing PORT', () => {
    expect(errorMessageOf({ ...BASE, PORT: undefined })).toContain('- PORT: falta la variable');
  });

  it('reports a non numeric PORT with its reason', () => {
    expect(errorMessageOf({ ...BASE, PORT: 'abc' })).toContain(
      '- PORT: debe ser un entero entre 1 y 65535',
    );
  });

  it('reports a PORT out of range', () => {
    expect(errorMessageOf({ ...BASE, PORT: '70000' })).toContain(
      '- PORT: debe ser un entero entre 1 y 65535',
    );
  });

  it('reports an invalid NODE_ENV', () => {
    expect(errorMessageOf({ ...BASE, NODE_ENV: 'staging' })).toContain(
      '- NODE_ENV: debe ser development, test o production',
    );
  });

  it('lists every missing variable in a single message', () => {
    const message = errorMessageOf({});
    expect(message).toContain('- NODE_ENV: falta la variable');
    expect(message).toContain('- PORT: falta la variable');
    expect(message).toContain('- DATABASE_URL: falta la variable');
    expect(message).toContain('- CORS_ORIGINS: falta la variable');
  });

  it('accepts the postgres:// protocol in DATABASE_URL', () => {
    const url = 'postgres://gns:gns@localhost:5432/gns';
    expect(validateEnv({ ...BASE, DATABASE_URL: url }).DATABASE_URL).toBe(url);
  });

  it('reports a DATABASE_URL that is not a URL', () => {
    expect(errorMessageOf({ ...BASE, DATABASE_URL: 'gns' })).toContain(DATABASE_URL_REASON);
  });

  it('reports a DATABASE_URL with a protocol other than PostgreSQL', () => {
    expect(
      errorMessageOf({ ...BASE, DATABASE_URL: 'mysql://gns:gns@localhost:3306/gns' }),
    ).toContain(DATABASE_URL_REASON);
  });

  it('never prints the values it received', () => {
    const message = errorMessageOf({
      NODE_ENV: 's3cr3t-value',
      PORT: 'abc',
      DATABASE_URL: 'mysql://gns:s3cr3t-password@localhost/gns',
      CORS_ORIGINS: 'https://s3cr3t-origin.test/ruta',
      LOG_LEVEL: 's3cr3t-level',
    });
    expect(message).not.toContain('s3cr3t-value');
    expect(message).not.toContain('abc');
    expect(message).not.toContain('s3cr3t-password');
    expect(message).not.toContain('s3cr3t-origin');
    expect(message).not.toContain('s3cr3t-level');
  });

  it('parses a list of CORS origins', () => {
    const config = validateEnv({ ...BASE, CORS_ORIGINS: 'http://a.test, https://b.test:8443' });
    expect(config.CORS_ORIGINS).toEqual(['http://a.test', 'https://b.test:8443']);
  });

  it.each(['*', 'http://a.test/', 'http://a.test/ruta', 'a.test', 'http://a.test,', ' '])(
    'rejects the CORS origin list %p',
    (value) => {
      expect(errorMessageOf({ ...BASE, CORS_ORIGINS: value })).toContain('- CORS_ORIGINS:');
    },
  );

  it.each([
    ['RATE_LIMIT_WINDOW_SECONDS', '0'],
    ['RATE_LIMIT_WINDOW_SECONDS', '3601'],
    ['RATE_LIMIT_MAX_REQUESTS', '0'],
    ['RATE_LIMIT_MAX_REQUESTS', '10001'],
    ['RATE_LIMIT_MAX_REQUESTS', 'abc'],
    ['LOG_LEVEL', 'verbose'],
  ])('rejects %s=%s', (key, value) => {
    expect(errorMessageOf({ ...BASE, [key]: value })).toContain(`- ${key}:`);
  });

  it('applies the defaults for the limits and the log level', () => {
    expect(validateEnv(BASE)).toMatchObject({
      RATE_LIMIT_WINDOW_SECONDS: 60,
      RATE_LIMIT_MAX_REQUESTS: 100,
      LOG_LEVEL: 'info',
    });
  });
});
