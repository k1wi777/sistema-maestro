import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiCookieAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { UserRole } from '@gns/shared';

export const REQUIRED_ROLE_KEY = 'gns:required-role';

const ERROR_SCHEMA = { $ref: '#/components/schemas/ApiErrorBody' };

/**
 * Exige sesión válida y un rol que satisfaga `role` según la jerarquía (docente <
 * coordinador < administrador). Sin sesión responde 401 y con un rol insuficiente 403.
 * Los endpoints sin este decorador no exigen sesión.
 */
export const RequireRole = (role: UserRole) =>
  applyDecorators(
    SetMetadata(REQUIRED_ROLE_KEY, role),
    ApiCookieAuth(),
    ApiUnauthorizedResponse({ description: 'Sin sesión válida', schema: ERROR_SCHEMA }),
    ApiForbiddenResponse({ description: 'Rol insuficiente', schema: ERROR_SCHEMA }),
  );
