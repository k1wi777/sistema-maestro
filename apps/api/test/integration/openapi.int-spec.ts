import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, ModulesContainer } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { z } from 'zod';
import { AppModule } from '../../src/app.module';
import { buildOpenApiDocument } from '../../src/core/openapi/openapi';
import { createTestApp } from './support/create-test-app';

// Clave de metadata de `@ApiResponse` en @nestjs/swagger (su módulo de constantes no se exporta).
const API_RESPONSE_METADATA = 'swagger/apiResponse';

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
  'post /field-journals/{id}/submit',
  'post /field-journals/{id}/resubmit',
  'post /field-journals/{id}/annotations/{annotationId}/ready',
  'post /field-journals/{id}/annotations/{annotationId}/draft',
  'post /observer-notes/{id}/submit',
  'put /shared-activities/{id}/favorite',
  'post /training-modules/{id}/publish',
  'post /unanswered-questions/{id}/discard',
  'post /training-modules/{id}/withdraw',
  'post /training-modules/{id}/restore',
  'post /training-modules/{id}/activities/{activityId}/withdraw',
  'post /training-modules/{id}/activities/{activityId}/restore',
  'post /me/training/modules/{moduleId}/video-viewed',
  'post /me/training/modules/{moduleId}/presentation-viewed',
  'post /me/training/modules/{moduleId}/challenge',
  'post /me/training/modules/{moduleId}/challenge/next',
  'post /me/training/activities/{activityId}/game',
  'post /me/training/activities/{activityId}/game/next',
  'post /training-modules/{id}/files/{fileId}/confirm',
  'post /training-modules/{id}/files/{purpose}/url',
  'post /me/training/modules/{moduleId}/files/{purpose}/url',
  'post /me/training/certificates/{id}/download',
  'post /training-certificates/{id}/download',
]);

// Respuestas que no son JSON: se documentan con su tipo de contenido.
const NON_JSON_SUCCESS = new Map([
  ['get /training-tracking/plans/{planId}/export', 'text/csv'],
  ['get /audit-log/export', 'text/csv'],
]);

// --- Coherencia entre los esquemas Zod de los DTO y el documento ---

type JsonSchema = Record<string, unknown>;

interface ZodDtoClass {
  name: string;
  schema: z.ZodType;
}

interface Shape {
  kind: string;
  nullable: boolean;
  required: string[];
  properties: Record<string, JsonSchema>;
  items?: JsonSchema;
  branches: JsonSchema[];
}

const isSchema = (value: unknown): value is JsonSchema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isZodDtoClass = (value: unknown): value is ZodDtoClass =>
  typeof value === 'function' && 'schema' in value && 'isZodDto' in value;

/** Resuelve `$ref` (a `#/$defs/x` o a `#/components/schemas/x`) contra su raíz. */
function resolveRef(schema: JsonSchema, defs: Record<string, unknown>): JsonSchema {
  let current = schema;
  while (typeof current.$ref === 'string') {
    const target = defs[current.$ref.slice(current.$ref.lastIndexOf('/') + 1)];
    if (!isSchema(target)) throw new Error(`Referencia sin resolver: ${current.$ref}`);
    current = target;
  }
  return current;
}

/** Reduce un esquema a lo que importa al contrato: tipo, null, requeridos y estructura. */
function shapeOf(schema: JsonSchema, defs: Record<string, unknown>): Shape {
  const current = resolveRef(schema, defs);
  let nullable = current.nullable === true;
  const combined = (current.anyOf ?? current.oneOf) as JsonSchema[] | undefined;
  if (combined) {
    const isNull = (branch: JsonSchema) => resolveRef(branch, defs).type === 'null';
    nullable ||= combined.some(isNull);
    const rest = combined.filter((branch) => !isNull(branch));
    if (rest.length === 1 && rest[0]) {
      const inner = shapeOf(rest[0], defs);
      return { ...inner, nullable: nullable || inner.nullable };
    }
    return {
      kind: 'union',
      nullable,
      required: [],
      properties: {},
      branches: rest.map((branch) => resolveRef(branch, defs)),
    };
  }
  const type = Array.isArray(current.type) ? current.type.join('|') : current.type;
  const kind =
    type === 'integer' || type === 'number' ? 'number' : typeof type === 'string' ? type : 'scalar';
  return {
    kind,
    nullable,
    required: Array.isArray(current.required) ? [...(current.required as string[])].sort() : [],
    properties: isSchema(current.properties)
      ? (current.properties as Record<string, JsonSchema>)
      : {},
    items: isSchema(current.items) ? current.items : undefined,
    branches: [],
  };
}

function compareSchemas(
  expected: JsonSchema,
  expectedDefs: Record<string, unknown>,
  actual: JsonSchema,
  actualDefs: Record<string, unknown>,
  path: string,
  diffs: string[],
): void {
  // Los esquemas del contrato no son recursivos; el límite evita un bucle si alguno lo fuese.
  if (path.length > 400) return;
  const want = shapeOf(expected, expectedDefs);
  const got = shapeOf(actual, actualDefs);
  const describe = (shape: Shape) => `${shape.kind}${shape.nullable ? ' | null' : ''}`;
  if (describe(want) !== describe(got)) {
    diffs.push(`${path}: esperado ${describe(want)}, obtenido ${describe(got)}`);
    return;
  }
  if (want.required.join() !== got.required.join()) {
    diffs.push(
      `${path}: required esperado [${want.required.join()}], obtenido [${got.required.join()}]`,
    );
  }
  const names = new Set([...Object.keys(want.properties), ...Object.keys(got.properties)]);
  for (const name of names) {
    const wantProperty = want.properties[name];
    const gotProperty = got.properties[name];
    if (!wantProperty || !gotProperty) {
      diffs.push(
        `${path}.${name}: ${wantProperty ? 'falta en el documento' : 'sobra en el documento'}`,
      );
      continue;
    }
    compareSchemas(wantProperty, expectedDefs, gotProperty, actualDefs, `${path}.${name}`, diffs);
  }
  if (want.items && got.items) {
    compareSchemas(want.items, expectedDefs, got.items, actualDefs, `${path}[]`, diffs);
  }
  if (want.branches.length !== got.branches.length) {
    diffs.push(
      `${path}: ${want.branches.length} ramas esperadas, ${got.branches.length} obtenidas`,
    );
  } else {
    want.branches.forEach((branch, index) => {
      const other = got.branches[index];
      if (other)
        compareSchemas(branch, expectedDefs, other, actualDefs, `${path}<${index}>`, diffs);
    });
  }
}

interface ZodResponseRoute {
  method: string;
  openApiPath: string;
  status: string;
  dto: ZodDtoClass;
  list: boolean;
}

/** DTO de Zod declarados como respuesta 2xx de cada handler (`@ZodResponse` → `@ApiResponse`). */
function zodResponses(app: INestApplication): ZodResponseRoute[] {
  const found: ZodResponseRoute[] = [];
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
      const responses = (Reflect.getMetadata(API_RESPONSE_METADATA, handler) ?? {}) as Record<
        string,
        { type?: unknown; isArray?: boolean }
      >;
      for (const [status, response] of Object.entries(responses)) {
        if (!/^2/.test(status)) continue;
        const declared = Array.isArray(response.type)
          ? (response.type as unknown[])[0]
          : response.type;
        if (!isZodDtoClass(declared)) continue;
        found.push({
          method: RequestMethod[method].toLowerCase(),
          openApiPath: joinPaths(controllerPath, path).replace(/:([A-Za-z]+)/g, '{$1}'),
          status,
          dto: declared,
          list: Array.isArray(response.type) || response.isArray === true,
        });
      }
    }
  }
  return found;
}

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

  it('coincide con la copia del contrato con la que compila el frontend', async () => {
    const copy = JSON.parse(
      readFileSync(join(__dirname, '../../../web/src/shared/api/openapi.json'), 'utf8'),
    ) as unknown;
    // La app de pruebas añade endpoints de ejemplo y de fallos que no son la API: se compara
    // con la API real (solo AppModule), igual que `openapi:export`, sin iniciarla.
    const testing = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const real = testing.createNestApplication();
    let current: unknown;
    try {
      current = JSON.parse(JSON.stringify(buildOpenApiDocument(real)));
    } finally {
      await real.close();
    }
    // Se lanza un error propio: la diferencia de un documento de cientos de KB no orienta.
    if (!isDeepStrictEqual(copy, current)) {
      throw new Error(
        'El contrato OpenAPI de la API difiere de apps/web/src/shared/api/openapi.json. ' +
          'Ejecuta `pnpm api:contract` y confirma el archivo actualizado.',
      );
    }
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
      const mediaType = NON_JSON_SUCCESS.get(`${method} ${openApiPath}`) ?? 'application/json';
      if (success?.[0] !== '204') {
        expect([label, success?.[1].content?.[mediaType]?.schema !== undefined]).toEqual([
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

  it('describe cada respuesta de Zod con el mismo tipo, null y requeridos que su esquema', () => {
    const componentSchemas = (document.components?.schemas ?? {}) as Record<string, unknown>;
    const responses = zodResponses(app);
    expect(responses.length).toBeGreaterThan(50);

    const diffs: string[] = [];
    for (const { method, openApiPath, status, dto, list } of responses) {
      const io = dto.name.endsWith('_Output') ? 'output' : 'input';
      const { $defs = {}, ...expected } = z.toJSONSchema(dto.schema, {
        io,
        target: 'openapi-3.0',
        unrepresentable: 'any',
      }) as JsonSchema;
      const actual = operations[openApiPath]?.[method]?.responses[status]?.content?.[
        'application/json'
      ]?.schema as JsonSchema | undefined;
      const label = `${method.toUpperCase()} ${openApiPath}`;
      if (!actual) {
        diffs.push(`${label}: sin esquema de respuesta ${status}`);
        continue;
      }
      const wanted: JsonSchema = list ? { type: 'array', items: expected } : expected;
      const found: string[] = [];
      compareSchemas(
        wanted,
        $defs as Record<string, unknown>,
        actual,
        componentSchemas,
        '$',
        found,
      );
      diffs.push(...found.map((diff) => `${label} → ${diff}`));
    }
    expect(diffs).toEqual([]);
  });

  it('no usa type en arreglo (OpenAPI 3.0) y documenta los historiales de revisión como arreglos', () => {
    const arrayTypes: string[] = [];
    const visit = (value: unknown, path: string) => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, `${path}[${index}]`));
      } else if (isSchema(value)) {
        if (Array.isArray(value.type)) arrayTypes.push(path);
        for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
      }
    };
    visit(document, '#');
    expect(arrayTypes).toEqual([]);

    for (const path of ['/lesson-plans/{id}/reviews', '/observer-notes/{id}/reviews']) {
      const schema = operations[path]?.get?.responses['200']?.content?.['application/json']
        ?.schema as JsonSchema | undefined;
      const resolved = schema ? resolveRef(schema, document.components?.schemas ?? {}) : undefined;
      expect([path, resolved?.type]).toEqual([path, 'array']);
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
