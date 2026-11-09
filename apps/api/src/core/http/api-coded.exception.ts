import { HttpException } from '@nestjs/common';
import type { ApiErrorCode } from '@gns/shared';

/**
 * Error HTTP con un código estable propio (`ApiErrorBody.code`). El frontend distingue
 * por el código, no por el texto: permite varios 403 o 409 con significados distintos.
 */
export class ApiCodedException extends HttpException {
  constructor(
    status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message, status);
  }
}
