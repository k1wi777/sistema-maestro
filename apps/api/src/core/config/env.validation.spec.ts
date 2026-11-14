import { validateEnv } from './env.validation';

const DATABASE_URL = 'postgresql://gns:gns@localhost:5432/gns';
const CORS_ORIGINS = 'http://localhost:3001';
// Secretos de prueba sin valor real: solo cumplen la longitud mínima.
const ACCESS_SECRET = 'prueba-acceso-'.padEnd(40, 'a');
const REFRESH_SECRET = 'prueba-renovacion-'.padEnd(40, 'r');
const BASE = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL,
  CORS_ORIGINS,
  JWT_ACCESS_SECRET: ACCESS_SECRET,
  REFRESH_TOKEN_SECRET: REFRESH_SECRET,
  DATA_POLICY_VERSION: '2026-1',
  STORAGE_ENDPOINT: 'http://localhost:9000',
  STORAGE_BUCKET: 'gns-files',
  STORAGE_ACCESS_KEY_ID: 'prueba-clave',
  STORAGE_SECRET_ACCESS_KEY: 'prueba-secreto-almacenamiento',
};
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
      JWT_ACCESS_SECRET: ACCESS_SECRET,
      ACCESS_TOKEN_TTL_MINUTES: 15,
      REFRESH_TOKEN_SECRET: REFRESH_SECRET,
      REFRESH_ROTATION_GRACE_SECONDS: 30,
      SESSION_IDLE_TIMEOUT_HOURS: 24,
      SESSION_REMEMBER_MAX_DAYS: 7,
      AUTH_COOKIE_SECURE: true,
      LOGIN_MAX_ATTEMPTS: 5,
      LOGIN_WINDOW_SECONDS: 300,
      DATA_POLICY_VERSION: '2026-1',
      STORAGE_ENDPOINT: 'http://localhost:9000',
      STORAGE_REGION: 'auto',
      STORAGE_BUCKET: 'gns-files',
      STORAGE_ACCESS_KEY_ID: 'prueba-clave',
      STORAGE_SECRET_ACCESS_KEY: 'prueba-secreto-almacenamiento',
      STORAGE_FORCE_PATH_STYLE: true,
      STORAGE_SIGNED_URL_TTL_SECONDS: 300,
      STORAGE_VIEW_URL_TTL_SECONDS: 7200,
    });
  });

  describe('storage', () => {
    it('lists every missing storage variable without values', () => {
      const message = errorMessageOf({
        ...BASE,
        STORAGE_ENDPOINT: undefined,
        STORAGE_BUCKET: undefined,
        STORAGE_ACCESS_KEY_ID: undefined,
        STORAGE_SECRET_ACCESS_KEY: undefined,
      });
      expect(message).toContain('- STORAGE_ENDPOINT: falta la variable');
      expect(message).toContain('- STORAGE_BUCKET: falta la variable');
      expect(message).toContain('- STORAGE_ACCESS_KEY_ID: falta la variable');
      expect(message).toContain('- STORAGE_SECRET_ACCESS_KEY: falta la variable');
    });

    it('rejects an invalid bucket name without showing its value', () => {
      const message = errorMessageOf({ ...BASE, STORAGE_BUCKET: 'Mal_Bucket' });
      expect(message).toContain('- STORAGE_BUCKET: debe ser un nombre de bucket válido');
      expect(message).not.toContain('Mal_Bucket');
    });

    it('rejects a view TTL shorter than the download TTL', () => {
      const message = errorMessageOf({
        ...BASE,
        STORAGE_SIGNED_URL_TTL_SECONDS: '3000',
        STORAGE_VIEW_URL_TTL_SECONDS: '1000',
      });
      expect(message).toContain('- STORAGE_VIEW_URL_TTL_SECONDS: debe ser un entero');
    });

    it('rejects TTLs out of range', () => {
      expect(errorMessageOf({ ...BASE, STORAGE_SIGNED_URL_TTL_SECONDS: '30' })).toContain(
        '- STORAGE_SIGNED_URL_TTL_SECONDS',
      );
      expect(errorMessageOf({ ...BASE, STORAGE_VIEW_URL_TTL_SECONDS: '30000' })).toContain(
        '- STORAGE_VIEW_URL_TTL_SECONDS',
      );
    });

    it('requires an https endpoint in production', () => {
      const secure = {
        ...BASE,
        NODE_ENV: 'production',
        AUTH_COOKIE_SECURE: 'true',
        STORAGE_ENDPOINT: 'https://cuenta.r2.cloudflarestorage.com',
      };
      expect(validateEnv(secure).STORAGE_ENDPOINT).toBe('https://cuenta.r2.cloudflarestorage.com');
      expect(errorMessageOf({ ...secure, STORAGE_ENDPOINT: 'http://localhost:9000' })).toContain(
        '- STORAGE_ENDPOINT',
      );
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
    expect(message).toContain('- JWT_ACCESS_SECRET: falta la variable');
    expect(message).toContain('- REFRESH_TOKEN_SECRET: falta la variable');
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

  describe('authentication settings', () => {
    it('applies the session defaults', () => {
      expect(validateEnv({ ...BASE, AUTH_COOKIE_SECURE: undefined })).toMatchObject({
        ACCESS_TOKEN_TTL_MINUTES: 15,
        REFRESH_ROTATION_GRACE_SECONDS: 30,
        SESSION_IDLE_TIMEOUT_HOURS: 24,
        SESSION_REMEMBER_MAX_DAYS: 7,
        AUTH_COOKIE_SECURE: true,
        LOGIN_MAX_ATTEMPTS: 5,
        LOGIN_WINDOW_SECONDS: 300,
      });
    });

    it.each(['JWT_ACCESS_SECRET', 'REFRESH_TOKEN_SECRET'])('requires %s', (key) => {
      expect(errorMessageOf({ ...BASE, [key]: undefined })).toContain(
        `- ${key}: falta la variable`,
      );
    });

    it('rejects a secret shorter than 32 characters', () => {
      expect(errorMessageOf({ ...BASE, JWT_ACCESS_SECRET: 'corto' })).toContain(
        '- JWT_ACCESS_SECRET: debe tener al menos 32 caracteres',
      );
    });

    it('rejects equal secrets', () => {
      expect(errorMessageOf({ ...BASE, REFRESH_TOKEN_SECRET: ACCESS_SECRET })).toContain(
        '- REFRESH_TOKEN_SECRET:',
      );
    });

    it.each([
      ['ACCESS_TOKEN_TTL_MINUTES', '0'],
      ['ACCESS_TOKEN_TTL_MINUTES', '61'],
      ['REFRESH_ROTATION_GRACE_SECONDS', '-1'],
      ['REFRESH_ROTATION_GRACE_SECONDS', '301'],
      ['SESSION_IDLE_TIMEOUT_HOURS', '0'],
      ['SESSION_IDLE_TIMEOUT_HOURS', '721'],
      ['SESSION_REMEMBER_MAX_DAYS', '0'],
      ['SESSION_REMEMBER_MAX_DAYS', '91'],
      ['AUTH_COOKIE_SECURE', 'si'],
      ['LOGIN_MAX_ATTEMPTS', '0'],
      ['LOGIN_WINDOW_SECONDS', '3601'],
    ])('rejects %s=%s', (key, value) => {
      expect(errorMessageOf({ ...BASE, [key]: value })).toContain(`- ${key}:`);
    });

    it('rejects a remember-me maximum that does not exceed the inactivity timeout', () => {
      expect(
        errorMessageOf({
          ...BASE,
          SESSION_IDLE_TIMEOUT_HOURS: '72',
          SESSION_REMEMBER_MAX_DAYS: '3',
        }),
      ).toContain('- SESSION_REMEMBER_MAX_DAYS:');
    });

    it('requires Secure cookies in production but not elsewhere', () => {
      expect(
        errorMessageOf({ ...BASE, NODE_ENV: 'production', AUTH_COOKIE_SECURE: 'false' }),
      ).toContain('- AUTH_COOKIE_SECURE:');
      expect(
        validateEnv({
          ...BASE,
          NODE_ENV: 'production',
          STORAGE_ENDPOINT: 'https://cuenta.r2.cloudflarestorage.com',
        }).AUTH_COOKIE_SECURE,
      ).toBe(true);
      expect(validateEnv({ ...BASE, AUTH_COOKIE_SECURE: 'false' }).AUTH_COOKIE_SECURE).toBe(false);
    });

    it('never prints the secrets it received', () => {
      const message = errorMessageOf({
        ...BASE,
        JWT_ACCESS_SECRET: 's3cr3t',
        REFRESH_TOKEN_SECRET: 's3cr3t',
      });
      expect(message).not.toContain('s3cr3t');
    });
  });

  describe('DATA_POLICY_VERSION', () => {
    it('is required', () => {
      expect(errorMessageOf({ ...BASE, DATA_POLICY_VERSION: undefined })).toContain(
        '- DATA_POLICY_VERSION: falta la variable',
      );
    });

    it.each(['', 'con espacio', 'a'.repeat(21), 'v/1'])('rejects %j', (value) => {
      expect(errorMessageOf({ ...BASE, DATA_POLICY_VERSION: value })).toContain(
        '- DATA_POLICY_VERSION:',
      );
    });

    it.each(['2026-1', 'v1.2_b', 'a'.repeat(20)])('accepts %j', (value) => {
      expect(validateEnv({ ...BASE, DATA_POLICY_VERSION: value }).DATA_POLICY_VERSION).toBe(value);
    });
  });
});
