import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiCookieAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { UserRole } from '@gns/shared';

export const ACCESS_KEY = 'gns:access';
export const ALLOW_WITHOUT_CONSENT_KEY = 'gns:allow-without-consent';

/** Declaración de acceso de un endpoint: público o conjunto explícito de roles. */
export type AccessRule = { kind: 'public' } | { kind: 'roles'; roles: ReadonlySet<UserRole> };

const ERROR_SCHEMA = { $ref: '#/components/schemas/ApiErrorBody' };

/**
 * El acceso se deniega por defecto: todo endpoint declara `@Public()` o `@Roles`
 * (en el método o en la clase; el método prevalece). Un endpoint sin declaración impide
 * arrancar la API y, si aun así recibe una petición, responde 403.
 */
export const Public = () => SetMetadata(ACCESS_KEY, { kind: 'public' } satisfies AccessRule);

/**
 * Exige sesión válida, aviso de datos aceptado (salvo `@AllowWithoutConsent`) y que el rol de
 * la sesión pertenezca al conjunto declarado. No hay jerarquía: un rol superior no hereda los
 * endpoints de uno inferior.
 */
export const Roles = (...roles: [UserRole, ...UserRole[]]) =>
  applyDecorators(
    SetMetadata(ACCESS_KEY, { kind: 'roles', roles: new Set(roles) } satisfies AccessRule),
    ApiCookieAuth(),
    ApiUnauthorizedResponse({ description: 'Sin sesión válida', schema: ERROR_SCHEMA }),
    ApiForbiddenResponse({
      description: 'Rol no permitido o aviso de datos sin aceptar',
      schema: ERROR_SCHEMA,
    }),
  );

/**
 * Permite el endpoint a un usuario con sesión que aún no aceptó el aviso de datos. Solo
 * tiene efecto junto a `@Roles`: consultar y aceptar el aviso y consultar el usuario propio.
 */
export const AllowWithoutConsent = () => SetMetadata(ALLOW_WITHOUT_CONSENT_KEY, true);
