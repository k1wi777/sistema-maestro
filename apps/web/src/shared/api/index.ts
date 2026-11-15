// API pública de shared/api: contrato tipado, cliente HTTP con renovación y errores.
export type { components, paths } from './generated/schema';
export {
  NETWORK_ERROR_CODE,
  isConsentRequired,
  networkError,
  toApiError,
  type ApiError,
  type NetworkErrorBody,
} from './api-error';
export { api, callApi, type ApiResult } from './client';
export { onSessionEvent, type SessionEvent } from './session-events';
export { parseListResult, parseResult, type Parser } from './parse';
