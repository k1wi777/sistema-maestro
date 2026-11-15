import {
  certificateListSchema,
  certificateVerificationSchema,
  signedUrlSchema,
  type CertificateSummary,
  type CertificateVerification,
  type SignedUrlResult,
} from '@gns/shared';

import { api, callApi, parseResult, type ApiResult } from '@/shared/api';

/** Certificados del docente, del más reciente al más antiguo. */
export async function listMyCertificates(): Promise<ApiResult<CertificateSummary[]>> {
  const result = await callApi(() => api.GET('/me/training/certificates'));
  const parsed = parseResult(result, certificateListSchema);
  return parsed.ok ? { ok: true, data: parsed.data.items } : parsed;
}

/** URL firmada de descarga; la primera vez genera el PDF. */
export async function downloadCertificate(id: string): Promise<ApiResult<SignedUrlResult>> {
  const result = await callApi(() =>
    api.POST('/me/training/certificates/{id}/download', { params: { path: { id } } }),
  );
  return parseResult(result, signedUrlSchema);
}

/** Verificación pública: el código se envía tal como lo escribió la persona. */
export async function verifyCertificate(code: string): Promise<ApiResult<CertificateVerification>> {
  const result = await callApi(() =>
    api.GET('/certificates/verify/{code}', { params: { path: { code } } }),
  );
  return parseResult(result, certificateVerificationSchema);
}
