import { Logger, type ArgumentsHost } from '@nestjs/common';
import { ApiErrorCode } from '@gns/shared';
import { StorageUnavailableError } from '../../shared/storage/storage-unavailable.error';
import { ApiCodedException } from './api-coded.exception';
import { ApiExceptionFilter } from './api-exception.filter';

function run(exception: unknown) {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  const response = {
    status,
    json,
    getHeader: () => undefined,
    setHeader: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({ getRequest: () => ({ id: 'req-1' }), getResponse: () => response }),
  } as unknown as ArgumentsHost;
  new ApiExceptionFilter().catch(exception, host);
  return {
    status: (status.mock.calls as number[][])[0]?.[0],
    body: (json.mock.calls as unknown[][])[0]?.[0],
  };
}

describe('ApiExceptionFilter', () => {
  it('uses the code and message of an ApiCodedException', () => {
    const { status, body } = run(
      new ApiCodedException(403, ApiErrorCode.ConsentRequired, 'Debes aceptar el aviso'),
    );

    expect(status).toBe(403);
    expect(body).toEqual({
      statusCode: 403,
      code: 'consentimiento_requerido',
      message: 'Debes aceptar el aviso',
      requestId: 'req-1',
    });
  });

  it('answers 503 with a stable code and no storage details', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { status, body } = run(
      new StorageUnavailableError({ cause: new Error('connect ECONNREFUSED http://minio:9000') }),
    );

    expect(status).toBe(503);
    expect(body).toEqual({
      statusCode: 503,
      code: 'almacenamiento_no_disponible',
      message: expect.stringContaining('almacenamiento') as string,
      requestId: 'req-1',
    });
    expect(JSON.stringify(body)).not.toContain('minio');
  });
});
