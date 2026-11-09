import type { UserRole } from '@gns/shared';

/**
 * Usuario de la sesión: lo adjunta a `request.user` el guard de sesión con el rol
 * vigente en la base de datos. Sin sesión válida no hay `request.user` y las
 * acciones se auditan sin usuario y con el rol `desconocido`.
 */
export interface RequestUser {
  id: string;
  role: UserRole;
  sessionId: string;
}
