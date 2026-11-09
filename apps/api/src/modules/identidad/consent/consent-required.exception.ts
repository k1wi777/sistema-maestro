import { ApiErrorCode } from '@gns/shared';
import { ApiCodedException } from '../../../core/http/api-coded.exception';

/** 403 de un usuario con sesión válida que aún no aceptó la versión vigente del aviso. */
export class ConsentRequiredException extends ApiCodedException {
  constructor() {
    super(
      403,
      ApiErrorCode.ConsentRequired,
      'Debes aceptar el aviso de tratamiento de datos para continuar',
    );
  }
}
