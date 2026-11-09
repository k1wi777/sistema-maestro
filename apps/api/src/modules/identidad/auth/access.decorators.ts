import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiCookieAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { UserRole } from '@gns/shared';

export const ACCESS_KEY = 'gns:access';
export const ALLOW_WITHOUT_CONSENT_KEY = 'gns:allow-without-consent';

/** Declaración de acceso de un endpoint: público o rol mínimo. */
export type AccessRule = { kind: 'public' } | { kind: 'role'; role: UserRole };

const ERROR_SCHEMA = { $ref: '#/components/schemas/ApiErrorBody' };

/**
 * El acceso se deniega por defecto: todo endpoint declara `@Public()` o `@RequireRole`
 * (en el método o en la clase; el método prevalece). Un endpoint sin declaración impide
 * arrancar la API y, si aun así recibe una petición, responde 403.
 */
export const Public = () => SetMetadata(ACCESS_KEY, { kind: 'public' } satisfies AccessRule);

/**
 * Exige sesión válida, aviso de datos aceptado (salvo `@AllowWithoutConsent`) y un rol que
 * satisfaga `role` según la jerarquía (docente < coordinador < administrador).
 */
export const RequireRole = (role: UserRole) =>
  applyDecorators(
    SetMetadata(ACCESS_KEY, { kind: 'role', role } satisfies AccessRule),
    ApiCookieAuth(),
    ApiUnauthorizedResponse({ description: 'Sin sesión válida', schema: ERROR_SCHEMA }),
    ApiForbiddenResponse({
      description: 'Rol insuficiente o aviso de datos sin aceptar',
      schema: ERROR_SCHEMA,
    }),
  );

/**
 * Permite el endpoint a un usuario con sesión que aún no aceptó el aviso de datos. Solo
 * tiene efecto junto a `@RequireRole`: consultar y aceptar el aviso y consultar el usuario propio.
 */
export const AllowWithoutConsent = () => SetMetadata(ALLOW_WITHOUT_CONSENT_KEY, true);
