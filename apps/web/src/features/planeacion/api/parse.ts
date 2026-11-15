import { networkError, type ApiResult } from '@/shared/api';

/** Lo único que se pide a un esquema de `@gns/shared`: validar y devolver el valor tipado. */
export interface Parser<T> {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false };
}

/**
 * Valida con el esquema compartido la respuesta de la API. Los tipos generados del contrato
 * describen mal los campos que aceptan `null` (los muestran como `string[]`) y las fechas, así que
 * la feature trabaja con los tipos de `@gns/shared`; una respuesta que no los cumple se trata como
 * un fallo de conexión en lugar de pintar datos corruptos.
 */
export function parseResult<T>(result: ApiResult<unknown>, parser: Parser<T>): ApiResult<T> {
  if (!result.ok) {
    return result;
  }
  const parsed = parser.safeParse(result.data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: networkError() };
}

/** Igual que `parseResult` para una lista de elementos. */
export function parseListResult<T>(result: ApiResult<unknown>, parser: Parser<T>): ApiResult<T[]> {
  if (!result.ok) {
    return result;
  }
  if (!Array.isArray(result.data)) {
    return { ok: false, error: networkError() };
  }
  const items: T[] = [];
  for (const item of result.data as unknown[]) {
    const parsed = parser.safeParse(item);
    if (!parsed.success) {
      return { ok: false, error: networkError() };
    }
    items.push(parsed.data);
  }
  return { ok: true, data: items };
}
