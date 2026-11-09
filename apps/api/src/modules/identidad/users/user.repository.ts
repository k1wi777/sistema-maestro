import type { ListQuery, Page, User, UserRole, UserStatus } from '@gns/shared';
import type { ReadRepository } from '../../../shared/repository/repository';

export interface UserFilters {
  role?: UserRole;
  status?: UserStatus;
  /** Texto contenido en el nombre o en el correo, sin distinguir mayúsculas. */
  search?: string;
}

export const USER_SORT_FIELDS = ['fullName', 'email', 'createdAt'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export interface NewUser {
  fullName: string;
  email: string;
  role: UserRole;
  createdById: string;
}

export interface UserChanges {
  fullName?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface UserRepository extends ReadRepository<User, UserFilters, UserSortField> {
  findPage(query: ListQuery<UserFilters, UserSortField>): Promise<Page<User>>;
  /** El correo ya viene normalizado (minúsculas). */
  findByEmail(email: string): Promise<User | null>;
  create(input: NewUser): Promise<User>;
  update(id: string, changes: UserChanges): Promise<User>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
