import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Valida la query de un listado con un esquema de `createListQuerySchema`.
 * Responde 400 con un mensaje `<parámetro>: <motivo>` por problema. No define
 * el formato del cuerpo del error: lo unifica el filtro global de errores.
 */
export class ListQueryPipe<TSchema extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<TSchema>
> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    const messages = result.error.issues.flatMap((issue) => {
      if (issue.code === 'unrecognized_keys') {
        return issue.keys.map((key) => `${key}: parámetro desconocido`);
      }
      return [`${issue.path.join('.') || 'consulta'}: ${describeIssue(issue)}`];
    });
    throw new BadRequestException(messages);
  }
}

function describeIssue(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_value':
      return `valor no permitido (admitidos: ${issue.values.map(String).join(', ')})`;
    case 'too_big':
      return `debe ser como máximo ${String(issue.maximum)}`;
    case 'too_small':
      return `debe ser como mínimo ${String(issue.minimum)}`;
    default:
      return issue.message === 'Invalid input' ? 'valor inválido' : issue.message;
  }
}
