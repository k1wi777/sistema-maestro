import { ApiBody } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { z } from 'zod';

/**
 * Documenta en OpenAPI el cuerpo de una unión de Zod: una unión no puede ser clase base de
 * `createZodDto`, así que el endpoint valida con `AppZodValidationPipe` y declara el esquema aquí.
 */
export const ZodRequestBody = (schema: z.ZodType) =>
  ApiBody({
    schema: z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input' }) as SchemaObject,
  });
