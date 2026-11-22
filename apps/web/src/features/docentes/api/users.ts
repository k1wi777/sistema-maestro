import {
  ASSIGNABLE_ROLES,
  createPageSchema,
  userSchema,
  type CreateUserInput,
  type Page,
  type UpdateUserInput,
  type User,
  type UserRole,
  type UserStatus,
} from '@gns/shared';

import { api, callApi, parseResult, type ApiResult } from '@/shared/api';

const userPageSchema = createPageSchema(userSchema);

export interface UserFilters {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}

/** Usuarios (solo administración): una página con búsqueda y filtros por rol y estado. */
export async function listUsers(
  filters: UserFilters,
  page: number,
  pageSize: number,
): Promise<ApiResult<Page<User>>> {
  const result = await callApi(() =>
    api.GET('/users', {
      params: {
        query: {
          page: String(page),
          pageSize: String(pageSize),
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.role ? { role: filters.role } : {}),
          ...(filters.status ? { status: filters.status } : {}),
        },
      },
    }),
  );
  return parseResult(result, userPageSchema);
}

/** Docentes y coordinadores (los roles que reciben asignaciones), todas las páginas. */
export async function listAssignableUsers(): Promise<ApiResult<User[]>> {
  const users: User[] = [];
  for (const role of ASSIGNABLE_ROLES) {
    for (let page = 1; ; page += 1) {
      const result = await listUsers({ role }, page, 100);
      if (!result.ok) {
        return result;
      }
      users.push(...result.data.items);
      if (page >= result.data.totalPages) {
        break;
      }
    }
  }
  return { ok: true, data: users };
}

export async function createUser(input: CreateUserInput): Promise<ApiResult<User>> {
  const result = await callApi(() => api.POST('/users', { body: input }));
  return parseResult(result, userSchema);
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<ApiResult<User>> {
  const result = await callApi(() =>
    api.PATCH('/users/{id}', { params: { path: { id } }, body: input }),
  );
  return parseResult(result, userSchema);
}

/** Cambia el rol (solo administración): retira asignaciones o grados y cierra las sesiones. */
export async function changeUserRole(id: string, role: UserRole): Promise<ApiResult<User>> {
  const result = await callApi(() =>
    api.PUT('/users/{id}/role', { params: { path: { id } }, body: { role } }),
  );
  return parseResult(result, userSchema);
}

/** Activa o desactiva una cuenta: nunca se borra. */
export async function setUserStatus(id: string, status: UserStatus): Promise<ApiResult<User>> {
  const result = await callApi(() =>
    api.PATCH('/users/{id}/status', { params: { path: { id } }, body: { status } }),
  );
  return parseResult(result, userSchema);
}
