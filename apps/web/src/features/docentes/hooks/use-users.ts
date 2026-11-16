'use client';

import type { User } from '@gns/shared';

import { usePagedList, type PagedList } from '@/shared/data';

import { listUsers, type UserFilters } from '../api/users';

const PAGE_SIZE = 20;

/** Usuarios con búsqueda y filtros por rol y estado, con «Cargar más» (solo administración). */
export function useUserList(filters: UserFilters): PagedList<User> {
  return usePagedList<User>(
    (page) => listUsers(filters, page, PAGE_SIZE),
    JSON.stringify([filters.search, filters.role, filters.status]),
  );
}
