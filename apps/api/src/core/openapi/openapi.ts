import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { PRODUCT_NAME, apiErrorBodySchema } from '@gns/shared';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { ACCESS_COOKIE } from '../../modules/identidad/auth/session-cookies';
import { z } from 'zod';

const API_ERROR_SCHEMA = 'ApiErrorBody';

const ERROR_RESPONSES: Record<string, string> = {
  '400': 'Datos inválidos',
  '404': 'No encontrado',
  '409': 'Conflicto con datos existentes',
  '429': 'Demasiadas peticiones',
  '500': 'Error interno',
};

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

function apiVersion(): string {
  // src/core/openapi (o dist/core/openapi) -> apps/api/package.json
  const manifest = join(__dirname, '..', '..', '..', 'package.json');
  return (JSON.parse(readFileSync(manifest, 'utf8')) as { version: string }).version;
}

/**
 * Añade a cada operación las respuestas de error en el formato común. Se hace aquí,
 * en un solo sitio, para no depender de que cada controlador recuerde un decorador.
 */
function addCommonErrors(document: OpenAPIObject): void {
  const errorSchema = z.toJSONSchema(apiErrorBodySchema, { target: 'openapi-3.0' }) as Record<
    string,
    unknown
  >;
  delete errorSchema.$schema;
  document.components ??= {};
  document.components.schemas = {
    ...document.components.schemas,
    [API_ERROR_SCHEMA]: errorSchema,
  };

  for (const path of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = path[method];
      if (!operation) {
        continue;
      }
      for (const [status, description] of Object.entries(ERROR_RESPONSES)) {
        operation.responses[status] ??= {
          description,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${API_ERROR_SCHEMA}` },
            },
          },
        };
      }
    }
  }
}

/** Documento OpenAPI derivado de los esquemas Zod de las peticiones y respuestas. */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const options = new DocumentBuilder()
    .setTitle(PRODUCT_NAME)
    .setVersion(apiVersion())
    // Sesión por cookie httpOnly: los endpoints con `@RequireRole` la exigen.
    .addCookieAuth(ACCESS_COOKIE)
    .build();
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, options));
  addCommonErrors(document);
  return document;
}

/** Monta `/docs` (interfaz) y `/docs-json` (documento). */
export function mountOpenApi(app: INestApplication): void {
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app), { jsonDocumentUrl: 'docs-json' });
}
