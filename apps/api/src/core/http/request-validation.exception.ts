import { BadRequestException } from '@nestjs/common';
import type { ApiFieldError } from '@gns/shared';

/** La petición no cumple el esquema Zod de su cuerpo, query o parámetros de ruta. */
export class RequestValidationException extends BadRequestException {
  constructor(readonly fieldErrors: ApiFieldError[]) {
    super('Los datos enviados no son válidos');
  }
}
