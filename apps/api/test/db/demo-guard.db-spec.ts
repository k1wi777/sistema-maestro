import { assertDemoAllowed } from '../../prisma/seed/demo/demo-guard.ts';

// La barrera es una función pura: no necesita la base de datos (R25).

const LOCAL_URL = 'postgresql://gns:clave-secreta@localhost:5432/gns';

describe('assertDemoAllowed', () => {
  it.each([
    ['development', LOCAL_URL],
    ['test', LOCAL_URL],
    ['development', 'postgresql://gns:gns@127.0.0.1:5432/gns'],
    ['development', 'postgresql://gns:gns@[::1]:5432/gns'],
  ])('allows NODE_ENV=%s with %s', (NODE_ENV, DATABASE_URL) => {
    expect(() => assertDemoAllowed({ NODE_ENV, DATABASE_URL })).not.toThrow();
  });

  it.each([['production'], ['staging'], ['Development'], ['development '], [''], [undefined]])(
    'rejects NODE_ENV=%s',
    (NODE_ENV) => {
      expect(() => assertDemoAllowed({ NODE_ENV, DATABASE_URL: LOCAL_URL })).toThrow(/NODE_ENV/);
    },
  );

  it.each([
    ['a remote host', 'postgresql://gns:clave-secreta@db.ejemplo.com:5432/gns'],
    ['a look-alike host', 'postgresql://gns:clave-secreta@localhost.ejemplo.com:5432/gns'],
    ['a private network address', 'postgresql://gns:clave-secreta@10.0.0.5:5432/gns'],
    ['a userinfo that fakes localhost', 'postgresql://localhost:5432@db.ejemplo.com/gns'],
    ['a host override in the query', `${LOCAL_URL}?host=db.ejemplo.com`],
    ['a hostaddr override in the query', `${LOCAL_URL}?hostaddr=10.0.0.5`],
  ])('rejects %s', (_name, DATABASE_URL) => {
    expect(() => assertDemoAllowed({ NODE_ENV: 'development', DATABASE_URL })).toThrow(/local/);
  });

  it.each([[undefined], [''], ['no es una url']])('rejects DATABASE_URL %s', (DATABASE_URL) => {
    expect(() => assertDemoAllowed({ NODE_ENV: 'development', DATABASE_URL })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('never prints the connection URL or its password', () => {
    for (const env of [
      { NODE_ENV: 'production', DATABASE_URL: LOCAL_URL },
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://gns:clave-secreta@db.ejemplo.com/gns',
      },
    ]) {
      let message = '';
      try {
        assertDemoAllowed(env);
      } catch (error) {
        message = error instanceof Error ? error.message : '';
      }

      expect(message).not.toContain('clave-secreta');
      expect(message).not.toContain('db.ejemplo.com');
    }
  });
});
