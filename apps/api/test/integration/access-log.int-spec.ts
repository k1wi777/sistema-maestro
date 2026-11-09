import type { Server } from 'node:http';
import { Writable } from 'node:stream';
import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema } from '@gns/shared';
import request from 'supertest';
import { createTestApp } from './support/create-test-app';

const ALLOWED_ORIGIN = process.env.CORS_ORIGINS?.split(',')[0] ?? '';

interface AccessEntry {
  level: number;
  req: { id: string; method: string; path: string };
  res: { statusCode: number };
  responseTime: number;
}

describe('log de acceso y errores del body parser', () => {
  let app: INestApplication;
  let lines: string[];
  const server = () => app.getHttpServer() as Server;

  beforeAll(async () => {
    lines = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    app = await createTestApp({ accessLogStream: stream, config: { LOG_LEVEL: 'info' } });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    lines.length = 0;
  });

  const entries = async (): Promise<AccessEntry[]> => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return lines.map((line) => JSON.parse(line) as AccessEntry);
  };

  const expectOneLog = async (
    res: { headers: Record<string, unknown> },
    method: string,
    path: string,
    statusCode: number,
  ) => {
    const found = await entries();
    expect(found).toHaveLength(1);
    const [entry] = found;
    expect(entry?.req).toEqual({ id: res.headers['x-request-id'], method, path });
    expect(entry?.res).toEqual({ statusCode });
    expect(entry?.responseTime).toEqual(expect.any(Number));
    expect(res.headers['x-request-id']).toMatch(/^[0-9A-Za-z-]{1,64}$/);
  };

  it('responde 413 con ApiErrorBody y sin log de error para un cuerpo de más de 100 KB', async () => {
    const res = await request(server())
      .post('/faq-example')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ texto: 'x'.repeat(110 * 1024) }));
    expect(res.status).toBe(413);
    const body = apiErrorBodySchema.parse(res.body);
    expect(body.requestId).toBe(res.headers['x-request-id']);
    const found = await entries();
    expect(found).toHaveLength(1);
    expect(found[0]?.level).toBe(40);
    expect(found[0]?.res.statusCode).toBe(413);
  });

  it('responde 415 con ApiErrorBody para un charset no admitido', async () => {
    const res = await request(server())
      .post('/faq-example')
      .set('Content-Type', 'application/json; charset=iso-8859-1')
      .send(Buffer.from('{}'));
    expect(res.status).toBe(415);
    apiErrorBodySchema.parse(res.body);
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('registra el rechazo de un JSON mal formado con el id de X-Request-Id', async () => {
    const res = await request(server())
      .post('/faq-example')
      .set('Content-Type', 'application/json')
      .send('{"nombre": ');
    expect(res.status).toBe(400);
    await expectOneLog(res, 'POST', '/faq-example', 400);
  });

  it('registra el preflight CORS', async () => {
    const res = await request(server())
      .options('/faq-example')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');
    await expectOneLog(res, 'OPTIONS', '/faq-example', res.status);
  });

  it.each(['/docs', '/docs-json'])('registra %s y devuelve X-Request-Id', async (path) => {
    const res = await request(server()).get(path).redirects(1);
    expect(res.status).toBe(200);
    const found = await entries();
    const last = found.at(-1);
    expect(last?.req.id).toBe(res.headers['x-request-id']);
    expect(last?.req.path).toBe(path);
  });

  it('registra una sola línea por petición normal, sin query string', async () => {
    const res = await request(server()).get('/faq-example?pageSize=5');
    await expectOneLog(res, 'GET', '/faq-example', 200);
    expect(lines.join('')).not.toContain('pageSize');
  });
});
