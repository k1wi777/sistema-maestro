import type { SessionProvider } from '@gns/shared';

/** Identidad ya verificada por un proveedor: lo único que la sesión necesita saber. */
export interface AuthenticatedIdentity {
  userId: string;
}

/**
 * Estrategia de autenticación. Solo verifica quién es la persona; la emisión y la
 * validación de sesiones no dependen de ella, así que registrar un proveedor nuevo
 * (p. ej. Google) no cambia la sesión, los guards ni la gestión de usuarios.
 */
export interface AuthProvider {
  /** Valor guardado en `sesion.proveedor`. */
  readonly name: SessionProvider;
  /** `null` si las credenciales no identifican a nadie. */
  authenticate(input: unknown): Promise<AuthenticatedIdentity | null>;
}

/** Proveedores registrados (multi-proveedor). */
export const AUTH_PROVIDERS = Symbol('AUTH_PROVIDERS');
