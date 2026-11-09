import { validateEnv } from './env.validation';

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
    expect(validateEnv({ NODE_ENV: 'development', PORT: '3000' })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
    });
  });

  it('reports a missing PORT', () => {
    expect(errorMessageOf({ NODE_ENV: 'test' })).toContain('- PORT: falta la variable');
  });

  it('reports a non numeric PORT with its reason', () => {
    expect(errorMessageOf({ NODE_ENV: 'test', PORT: 'abc' })).toContain(
      '- PORT: debe ser un entero entre 1 y 65535',
    );
  });

  it('reports a PORT out of range', () => {
    expect(errorMessageOf({ NODE_ENV: 'test', PORT: '70000' })).toContain(
      '- PORT: debe ser un entero entre 1 y 65535',
    );
  });

  it('reports an invalid NODE_ENV', () => {
    expect(errorMessageOf({ NODE_ENV: 'staging', PORT: '3000' })).toContain(
      '- NODE_ENV: debe ser development, test o production',
    );
  });

  it('lists every missing variable in a single message', () => {
    const message = errorMessageOf({});
    expect(message).toContain('- NODE_ENV: falta la variable');
    expect(message).toContain('- PORT: falta la variable');
  });

  it('never prints the values it received', () => {
    const message = errorMessageOf({ NODE_ENV: 's3cr3t-value', PORT: 'abc' });
    expect(message).not.toContain('s3cr3t-value');
    expect(message).not.toContain('abc');
  });
});
