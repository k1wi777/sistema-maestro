import { ApiErrorCode } from '@gns/shared';
import { ApiCodedException } from '../../../core/http/api-coded.exception';

/** 409 `catalogo_en_uso`: el elemento tiene registros o asignaciones y solo puede desactivarse. */
export class CatalogInUseException extends ApiCodedException {
  constructor(what: string, usageCount: number) {
    super(
      409,
      ApiErrorCode.CatalogInUse,
      `${what} está en uso (${usageCount} ${usageCount === 1 ? 'registro' : 'registros'}): desactívalo en lugar de borrarlo`,
    );
  }
}
