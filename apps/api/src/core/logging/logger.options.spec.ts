import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { createLoggerOptions } from './logger.options';

type PinoHttpArgs = Parameters<typeof pinoHttp>;

describe('createLoggerOptions', () => {
  let server: Server;
  let lines: string[];
  let port: number;

  beforeEach(async () => {
    lines = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const [options] = createLoggerOptions({ LOG_LEVEL: 'info' }, stream).pinoHttp as [
      PinoHttpArgs[0],
      unknown,
    ];
    const logger = pinoHttp({ ...options, logger: pino(options as pino.LoggerOptions, stream) });
    server = createServer((req, res) => {
      logger(req, res);
      req.resume();
      res.statusCode = 201;
      res.end('{"nombre":"Sofía"}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const send = (headers: Record<string, string> = {}) =>
    fetch(`http://127.0.0.1:${String(port)}/planes/ruta?nombre=Sofia&token=abc`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer secreto-jwt',
        cookie: 'sesion=secreto-cookie',
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ nombre: 'Andrés', password: 'secreto-clave' }),
    });

  it('logs id, method, path, status and duration as JSON and returns the id in the header', async () => {
    const response = await send();
    await response.text();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const entry = JSON.parse(lines[0] ?? '{}') as {
      req: { id: string; method: string; path: string };
      res: { statusCode: number };
      responseTime: number;
    };
    expect(entry.req).toEqual({
      id: expect.any(String) as string,
      method: 'POST',
      path: '/planes/ruta',
    });
    expect(entry.res).toEqual({ statusCode: 201 });
    expect(entry.responseTime).toEqual(expect.any(Number));
    expect(response.headers.get('x-request-id')).toBe(entry.req.id);
  });

  it('never writes bodies, query strings, cookies, authorization or personal data', async () => {
    await (await send()).text();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const output = lines.join('');
    for (const forbidden of ['Sofia', 'Sofía', 'Andrés', 'secreto', 'token=abc', 'nombre=']) {
      expect(output).not.toContain(forbidden);
    }
  });
});
