import type { Server } from 'node:http';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, ModulesContainer } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { createTestApp } from './support/create-test-app';

interface RegisteredRoute {
  method: string;
  openApiPath: string;
}

interface Operation {
  security?: Record<string, unknown>[];
  parameters?: { name: string; in: string }[];
  responses: Record<string, { content?: Record<string, { schema?: unknown }> }>;
  requestBody?: { content: Record<string, { schema?: unknown }> };
}

const joinPaths = (...parts: string[]) =>
  '/' +
  parts
    .flatMap((part) => part.split('/'))
    .filter(Boolean)
    .join('/');

/** Rutas que Nest registró, leídas de la metadata de los controladores. */
function registeredRoutes(app: INestApplication): RegisteredRoute[] {
  const routes: RegisteredRoute[] = [];
  for (const wrapper of new DiscoveryService(app.get(ModulesContainer)).getControllers()) {
    const instance = wrapper.instance as object | undefined;
    if (!instance) continue;
    const controllerPath = Reflect.getMetadata(PATH_METADATA, wrapper.metatype as object) as string;
    const prototype = Object.getPrototypeOf(instance) as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[name];
      if (typeof handler !== 'function') continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (method === undefined) continue;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
      routes.push({
        method: RequestMethod[method].toLowerCase(),
        openApiPath: joinPaths(controllerPath, path).replace(/:([A-Za-z]+)/g, '{$1}'),
      });
    }
  }
  return routes;
}

const ERROR_REF = '#/components/schemas/ApiErrorBody';

// Endpoints que no reciben cuerpo: la sesión viaja en cookies.
const BODYLESS = new Set([
  'post /auth/logout',
  'post /auth/refresh',
  'put /school-years/{id}/current',
  'post /lesson-plans/{id}/submit',
  'put /shared-activities/{id}/favorite',
]);

describe('documentación OpenAPI', () => {
  let app: INestApplication;
  let operations: Record<string, Record<string, Operation> | undefined>;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await createTestApp({ withFailures: false });
    const res = await request(app.getHttpServer() as Server)
      .get('/docs-json')
      .expect(200);
    document = res.body as OpenAPIObject;
    operations = document.paths as unknown as typeof operations;
  });

  afterAll(async () => {
    await app.close();
  });

  it('incluye todos los endpoints registrados con esquema de éxito, cuerpo y errores comunes', () => {
    const routes = registeredRoutes(app);
    expect(routes.length).toBeGreaterThanOrEqual(4);

    for (const { method, openApiPath } of routes) {
      const label = `${method.toUpperCase()} ${openApiPath}`;
      const operation = operations[openApiPath]?.[method];
      expect([label, operation !== undefined]).toEqual([label, true]);
      if (!operation) continue;

      for (const status of ['400', '404', '409', '429', '500']) {
        const schema = operation.responses[status]?.content?.['application/json']?.schema;
        expect([label, status, schema]).toEqual([label, status, { $ref: ERROR_REF }]);
      }
      const success = Object.entries(operation.responses).find(([status]) => /^2/.test(status));
      // Un 204 no tiene cuerpo que describir.
      if (success?.[0] !== '204') {
        expect([label, success?.[1].content?.['application/json']?.schema !== undefined]).toEqual([
          label,
          true,
        ]);
      }
      if (['post', 'put', 'patch'].includes(method) && !BODYLESS.has(`${method} ${openApiPath}`)) {
        const schema = operation.requestBody?.content['application/json']?.schema;
        expect([label, schema !== undefined]).toEqual([label, true]);
      }
    }
  });

  it('documenta el éxito y los parámetros de los endpoints de ejemplo con los esquemas Zod', () => {
    const list = operations['/faq-example']?.get;
    const successSchema = list?.responses['200']?.content?.['application/json']?.schema;
    expect(successSchema).toEqual({ $ref: '#/components/schemas/FaqExamplePageDto' });
    expect(list?.parameters?.map((parameter) => parameter.name)).toEqual(
      expect.arrayContaining(['page', 'pageSize', 'sortBy', 'sortOrder', 'category', 'isActive']),
    );
    expect(operations['/faq-example/{id}']?.get?.parameters?.[0]).toMatchObject({
      name: 'id',
      in: 'path',
    });
    expect(operations['/faq-example']?.post?.responses['201']).toBeDefined();
  });

  it('documenta la cookie de sesión y las respuestas 401 y 403 solo en los endpoints con rol', () => {
    const security = (document.components as { securitySchemes?: Record<string, unknown> })
      .securitySchemes;
    expect(security?.cookie).toMatchObject({ type: 'apiKey', in: 'cookie', name: 'gns_access' });

    for (const [path, method] of [
      ['/users', 'get'],
      ['/users/{id}/password', 'put'],
      ['/auth/me', 'get'],
      ['/consent', 'get'],
      ['/consent', 'post'],
      ['/teacher-assignments', 'get'],
      ['/school-years/{id}/current', 'put'],
      ['/me/assignments', 'get'],
    ] as const) {
      const operation = operations[path]?.[method];
      expect(operation?.security).toEqual([{ cookie: [] }]);
      for (const status of ['401', '403']) {
        expect(operation?.responses[status]?.content?.['application/json']?.schema).toEqual({
          $ref: ERROR_REF,
        });
      }
    }
    const publicLogin = operations['/auth/login']?.post as { security?: unknown } | undefined;
    expect(publicLogin?.security).toBeUndefined();
  });

  it('registra el esquema ApiErrorBody con sus campos', () => {
    const schema = document.components?.schemas?.ApiErrorBody as { properties: object };
    expect(Object.keys(schema.properties).sort()).toEqual(
      ['code', 'errors', 'message', 'requestId', 'statusCode'].sort(),
    );
  });

  it('sirve la interfaz en /docs fuera de producción', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/docs')
      .expect(200);
    expect(res.headers['content-type']).toContain('text/html');
  });
});

describe('documentación OpenAPI en producción', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ config: { NODE_ENV: 'production' } });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['/docs', '/docs-json'])('responde 404 en %s', async (path) => {
    await request(app.getHttpServer() as Server)
      .get(path)
      .expect(404);
  });
});
