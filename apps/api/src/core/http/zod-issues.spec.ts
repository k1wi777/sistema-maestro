import { createListQuerySchema, idParamSchema } from '@gns/shared';
import { z } from 'zod';
import { toFieldErrors } from './zod-issues';

function errorsOf(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) {
    throw new Error('La validación debía fallar');
  }
  return toFieldErrors(result.error.issues);
}

describe('toFieldErrors', () => {
  const list = createListQuerySchema({
    sortFields: ['question'],
    defaultSort: { field: 'question', order: 'asc' },
  });

  it('names the unknown query parameter', () => {
    expect(errorsOf(list, { extra: '1' })).toEqual([
      { field: 'extra', reason: 'parámetro desconocido' },
    ]);
  });

  it('lists the allowed values of a restricted field', () => {
    expect(errorsOf(list, { sortBy: 'answer' })).toEqual([
      { field: 'sortBy', reason: 'valor no permitido (admitidos: question)' },
    ]);
  });

  it('describes a number above its maximum', () => {
    expect(errorsOf(list, { pageSize: '101' })).toEqual([
      { field: 'pageSize', reason: 'debe ser como máximo 100' },
    ]);
  });

  it('keeps the custom message of the shared schemas', () => {
    expect(errorsOf(idParamSchema, { id: 'no-uuid' })).toEqual([
      { field: 'id', reason: 'debe ser un UUID' },
    ]);
  });

  it('reports required fields and wrong types in Spanish with the dotted path', () => {
    const schema = z.object({ items: z.array(z.object({ name: z.string() })) });
    expect(errorsOf(schema, { items: [{}] })).toEqual([
      { field: 'items.0.name', reason: 'es obligatorio' },
    ]);
    expect(errorsOf(schema, { items: [{ name: 5 }] })).toEqual([
      { field: 'items.0.name', reason: 'debe ser de tipo texto' },
    ]);
  });

  it('describes string and array lengths', () => {
    const schema = z.object({ name: z.string().min(3), tags: z.array(z.string()).max(1) });
    expect(errorsOf(schema, { name: 'ab', tags: ['a', 'b'] })).toEqual([
      { field: 'name', reason: 'debe tener como mínimo 3 caracteres' },
      { field: 'tags', reason: 'debe tener como máximo 1 elementos' },
    ]);
  });

  it('never repeats the received value in the reason', () => {
    const [error] = errorsOf(z.object({ email: z.email() }), { email: 'secreto@x' });
    expect(error?.reason).toBe('formato inválido');
  });
});
