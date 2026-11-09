/** Rol único de cada usuario (`usuario.rol`). */
export const UserRole = {
  Teacher: 'docente',
  Coordinator: 'coordinador',
  Administrator: 'administrador',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Estado de la cuenta (`usuario.estado`). */
export const UserStatus = {
  Active: 'activo',
  Inactive: 'inactivo',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
