/**
 * Acciones y detalles de las filas de bitácora de tipo `ingreso`. Nunca incluyen el correo
 * enviado, la IP, contraseñas, hashes ni tokens: una persona puede escribir su contraseña
 * en el campo del correo.
 */
export const LoginAuditAction = {
  SignedIn: 'Ingreso',
  FailedAttempt: 'Intento de ingreso fallido',
  TokenReuse: 'Sesiones revocadas por reutilización del token de renovación',
  PasswordChanged: 'Cambiar la contraseña propia',
} as const;

/** Motivo de un intento fallido (los dos primeros los decide el proveedor). */
export type FailedLoginReason = 'unknown_account' | 'wrong_password' | 'inactive_account';

export const FAILED_LOGIN_DETAIL: Record<FailedLoginReason, string> = {
  unknown_account: 'Correo no registrado',
  wrong_password: 'Contraseña incorrecta',
  inactive_account: 'Cuenta inactiva',
};

export const PASSWORD_CHANGED_DETAIL = 'Las demás sesiones se cerraron';
