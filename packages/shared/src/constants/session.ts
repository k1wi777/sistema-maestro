/** Proveedor que autenticó la sesión (`sesion.proveedor`). */
export const SessionProvider = {
  Password: 'contrasena',
} as const;
export type SessionProvider = (typeof SessionProvider)[keyof typeof SessionProvider];

/** Motivo por el que se revocó una sesión (`sesion.motivo_revocacion`). */
export const SessionRevocationReason = {
  Logout: 'cierre',
  Deactivation: 'desactivacion',
  PasswordChange: 'contrasena',
  TokenReuse: 'reutilizacion',
} as const;
export type SessionRevocationReason =
  (typeof SessionRevocationReason)[keyof typeof SessionRevocationReason];
