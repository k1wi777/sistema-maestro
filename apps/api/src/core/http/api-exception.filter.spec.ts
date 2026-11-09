import type { ArgumentsHost } from '@nestjs/common';
import { ApiErrorCode } from '@gns/shared';
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
});
