import createClient from 'openapi-fetch';

import { env } from '../config/env';
import { isConsentRequired, toApiError, networkError, type ApiError } from './api-error';
import type { paths } from './generated/schema';
import { createRenewingFetch } from './renewing-fetch';
import { emitSessionEvent } from './session-events';

/** Avisa al proveedor de sesión si la API exige aceptar el aviso de datos (403). */
async function observe(response: Response): Promise<Response> {
  if (response.status === 403) {
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => null);
    if (isConsentRequired(toApiError(body))) {
      emitSessionEvent('consent-required');
    }
  }
  return response;
}

const renewingFetch = createRenewingFetch({
  fetch: (request) => fetch(request),
  baseUrl: env.apiUrl,
  onSessionEnded: () => emitSessionEvent('ended'),
});

/** Cliente tipado con el contrato OpenAPI; envía la sesión por cookie y la renueva ante un 401. */
export const api = createClient<paths>({
  baseUrl: env.apiUrl,
  credentials: 'include',
  fetch: async (request) => observe(await renewingFetch(request)),
});

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

interface RawResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/**
 * Convierte el resultado de una llamada del cliente en `ApiResult`: los errores de la API pasan
 * por `toApiError` y un fallo de red (la petición lanza) se vuelve el error local `error_red`.
 */
export async function callApi<T>(call: () => Promise<RawResult<T>>): Promise<ApiResult<T>> {
  try {
    const result = await call();
    if (result.response.ok) {
      return { ok: true, data: result.data as T };
    }
    return { ok: false, error: toApiError(result.error) };
  } catch {
    return { ok: false, error: networkError() };
  }
}
