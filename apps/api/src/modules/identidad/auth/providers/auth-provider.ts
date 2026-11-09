import type { SessionProvider } from '@gns/shared';

/**
 * Resultado de un intento de autenticación. Un fallo identifica la cuenta (`userId`) cuando
 * el proveedor la encontró, para que el registro de ingresos conozca usuario y rol; la
 * respuesta HTTP no distingue los motivos.
 */
export type AuthAttempt =
  | { ok: true; userId: string }
  | { ok: false; reason: 'unknown_account' | 'wrong_password'; userId: string | null };

/**
 * Estrategia de autenticación. Solo verifica quién es la persona; la emisión y la
 * validación de sesiones no dependen de ella, así que registrar un proveedor nuevo
 * (p. ej. Google) no cambia la sesión, los guards ni la gestión de usuarios.
 */
export interface AuthProvider {
  /** Valor guardado en `sesion.proveedor`. */
  readonly name: SessionProvider;
  authenticate(input: unknown): Promise<AuthAttempt>;
}

/** Proveedores registrados (multi-proveedor). */
export const AUTH_PROVIDERS = Symbol('AUTH_PROVIDERS');
