import { ApiErrorCode, apiErrorBodySchema, type ApiErrorBody } from '@gns/shared';

/** Código local (no viene de la API) para un fallo de red o una respuesta que no se reconoce. */
export const NETWORK_ERROR_CODE = 'error_red';

export interface NetworkErrorBody {
  statusCode: 0;
  code: typeof NETWORK_ERROR_CODE;
  message: string;
}

/** Error de una llamada a la API: el cuerpo común de la API o un error local de red. */
export type ApiError = ApiErrorBody | NetworkErrorBody;

export function networkError(): NetworkErrorBody {
  return {
    statusCode: 0,
    code: NETWORK_ERROR_CODE,
    message: 'No pudimos conectar con la plataforma. Revisa tu conexión e inténtalo de nuevo.',
  };
}

/** Normaliza el cuerpo de una respuesta de error; si no es el formato común, es un error de red. */
export function toApiError(body: unknown): ApiError {
  const parsed = apiErrorBodySchema.safeParse(body);
  return parsed.success ? parsed.data : networkError();
}

export function isConsentRequired(error: ApiError): boolean {
  return error.code === ApiErrorCode.ConsentRequired;
}
