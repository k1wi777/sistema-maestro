import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, UserRole } from '@gns/shared';
import request from 'supertest';
import { createTestApp } from './support/create-test-app';
import { asUser, createTestUser, signIn } from './support/session';

const ALLOWED_ORIGIN = process.env.CORS_ORIGINS?.split(',')[0] ?? '';

describe('seguridad base', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as Server;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['una respuesta exitosa', '/faq-example', 200],
    ['una ruta inexistente', '/no-existe', 404],
    ['un error de validación', '/faq-example?pageSize=0', 400],
  ])('incluye las cabeceras de Helmet en %s', async (_name, path, status) => {
    const res = await request(server()).get(path).expect(status);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it.each([
    ['una respuesta exitosa', '/faq-example', 200],
    ['una ruta inexistente', '/no-existe', 404],
    ['un error de validación', '/faq-example?pageSize=0', 400],
    ['una petición sin sesión', '/users', 401],
  ])('no permite guardar en caché %s', async (_name, path, status) => {
    const res = await request(server()).get(path).expect(status);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('no permite guardar en caché una exportación CSV', async () => {
    const coordinator = await createTestUser(app, { role: UserRole.Coordinator });
    const cookies = await signIn(app, coordinator);

    const res = await asUser(app, 'get', '/audit-log/export', cookies, 'access').expect(200);

    expect(res.headers['content-type']).toMatch(/^text\/csv/);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('permite un origen listado con credenciales y expone el id de petición', async () => {
    const res = await request(server()).get('/faq-example').set('Origin', ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-expose-headers']).toContain('X-Request-Id');
  });

  it('no incluye Access-Control-Allow-Origin para un origen no listado', async () => {
    const res = await request(server()).get('/faq-example').set('Origin', 'https://intruso.test');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('responde el preflight solo al origen listado', async () => {
    const res = await request(server())
      .options('/faq-example')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('devuelve X-Request-Id y reutiliza solo uno inocuo', async () => {
    const generated = await request(server()).get('/faq-example');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const reused = await request(server()).get('/faq-example').set('X-Request-Id', 'cliente-123');
    expect(reused.headers['x-request-id']).toBe('cliente-123');

    const unsafe = await request(server()).get('/faq-example').set('X-Request-Id', 'a b;c');
    expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('límite de peticiones', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ config: { RATE_LIMIT_MAX_REQUESTS: 3 } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 429 en el formato común al superar el máximo de la ventana', async () => {
    const server = app.getHttpServer() as Server;
    for (let i = 0; i < 3; i++) {
      await request(server).get('/faq-example').expect(200);
    }
    const res = await request(server).get('/faq-example').expect(429);
    const body = apiErrorBodySchema.parse(res.body);
    expect(body).toMatchObject({ statusCode: 429, code: 'demasiadas_peticiones' });
    expect(body.requestId).toBe(res.headers['x-request-id']);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
