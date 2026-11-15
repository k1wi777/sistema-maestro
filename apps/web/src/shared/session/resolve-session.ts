import { api, callApi, type ApiError } from '../api';
import type { Resolution } from './session-state';

/** 401 de la API: sin sesión (ya se intentó renovar). */
const UNAUTHENTICATED = 401;

function isUnavailable(error: ApiError): boolean {
  return error.statusCode !== UNAUTHENTICATED;
}

/**
 * Resuelve la sesión del navegador: `GET /auth/me` (admite un aviso de datos sin aceptar) y,
 * si hay usuario, `GET /consent`. Un fallo de red o de la API no es una sesión cerrada.
 */
export async function resolveSession(): Promise<Resolution> {
  const me = await callApi(() => api.GET('/auth/me'));
  if (!me.ok) {
    return isUnavailable(me.error) ? { kind: 'unavailable' } : { kind: 'anonymous' };
  }
  const consent = await callApi(() => api.GET('/consent'));
  if (!consent.ok) {
    return consent.error.statusCode === UNAUTHENTICATED
      ? { kind: 'anonymous' }
      : { kind: 'unavailable' };
  }
  return {
    kind: 'authenticated',
    user: me.data,
    consent: consent.data.accepted ? 'accepted' : 'pending',
    policyVersion: consent.data.policyVersion,
  };
}
