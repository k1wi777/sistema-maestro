import type { ApiResult } from '@/shared/api';
import type { CertificateVerification } from '@gns/shared';

import { toVerificationOutcome } from './verification';
import { DATE } from './test-fixtures';

const failure = (statusCode: number): ApiResult<CertificateVerification> => ({
  ok: false,
  error: { statusCode, code: 'x', message: 'Mensaje de la API' } as never,
});

describe('toVerificationOutcome', () => {
  it('returns what the API verified', () => {
    const data: CertificateVerification = {
      valid: true,
      teacherName: 'Laura Demo',
      kind: 'modulo',
      title: 'Módulo uno',
      planName: 'Plan 1',
      issuedAt: DATE,
    };

    expect(toVerificationOutcome({ ok: true, data })).toEqual({ status: 'found', data });
  });

  it('treats an unknown or malformed code the same, without detail', () => {
    expect(toVerificationOutcome(failure(404))).toEqual({ status: 'not_found' });
    expect(toVerificationOutcome(failure(400))).toEqual({ status: 'not_found' });
  });

  it('tells apart the attempt limit and connection errors', () => {
    expect(toVerificationOutcome(failure(429))).toEqual({ status: 'too_many' });
    expect(toVerificationOutcome(failure(0))).toEqual({
      status: 'error',
      message: 'Mensaje de la API',
    });
    expect(toVerificationOutcome(failure(500))).toMatchObject({ status: 'error' });
  });
});
