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

/** Jerarquía de roles: un rol superior satisface a uno inferior. */
export const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.Teacher]: 1,
  [UserRole.Coordinator]: 2,
  [UserRole.Administrator]: 3,
};

/** Indica si `role` cumple el rol `required` según la jerarquía. */
export function roleSatisfies(role: UserRole, required: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}
