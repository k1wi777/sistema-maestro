import type { CertificateVerification } from '@gns/shared';

import type { ApiResult } from '@/shared/api';

export type VerificationOutcome =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; data: CertificateVerification }
  | { status: 'not_found' }
  | { status: 'too_many' }
  | { status: 'error'; message: string };

const NOT_FOUND_STATUSES = new Set([400, 404]);
const TOO_MANY_REQUESTS = 429;

/**
 * Resultado de la verificación pública. Un código que no existe o no tiene el formato correcto
 * (404, o 400 por dato inválido) se trata igual, sin más detalle; el límite de intentos (429) y los
 * fallos de red se distinguen para poder avisar y ofrecer reintentar.
 */
export function toVerificationOutcome(
  result: ApiResult<CertificateVerification>,
): VerificationOutcome {
  if (result.ok) {
    return { status: 'found', data: result.data };
  }
  if (NOT_FOUND_STATUSES.has(result.error.statusCode)) {
    return { status: 'not_found' };
  }
  if (result.error.statusCode === TOO_MANY_REQUESTS) {
    return { status: 'too_many' };
  }
  return { status: 'error', message: result.error.message };
}
