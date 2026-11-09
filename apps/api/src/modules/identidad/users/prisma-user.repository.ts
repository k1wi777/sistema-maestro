import { Injectable } from '@nestjs/common';
import type { ListQuery, Page, User, UserRole, UserStatus } from '@gns/shared';
import type { Prisma, User as UserRow } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { PrismaReadRepository } from '../../../shared/repository/prisma-read.repository';
import type {
  NewUser,
  UserChanges,
  UserFilters,
  UserRepository,
  UserSortField,
} from './user.repository';

// Campo de orden público -> campo del modelo. La base ordena por el nombre que recibe, así
// que `email` se traduce a `institutionalEmail` antes de delegar.
const SORT_COLUMNS: Record<UserSortField, string> = {
  fullName: 'fullName',
  email: 'institutionalEmail',
  createdAt: 'createdAt',
};

@Injectable()
export class PrismaUserRepository
  extends PrismaReadRepository<UserRow, Prisma.UserWhereInput, User, UserFilters, UserSortField>
  implements UserRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  override findPage(query: ListQuery<UserFilters, UserSortField>): Promise<Page<User>> {
    return super.findPage({
      ...query,
      sort: { field: SORT_COLUMNS[query.sort.field] as UserSortField, order: query.sort.order },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.db.user.findUnique({ where: { institutionalEmail: email } });
    return row ? this.toEntity(row) : null;
  }

  async create(input: NewUser): Promise<User> {
    const row = await this.prisma.db.user.create({
      data: {
        fullName: input.fullName,
        institutionalEmail: input.email,
        role: input.role,
        status: 'activo',
        createdById: input.createdById,
      },
    });
    return this.toEntity(row);
  }

  async update(id: string, changes: UserChanges): Promise<User> {
    const row = await this.prisma.db.user.update({
      where: { id },
      data: {
        fullName: changes.fullName,
        institutionalEmail: changes.email,
        role: changes.role,
        status: changes.status,
      },
    });
    return this.toEntity(row);
  }

  protected get delegate() {
    return this.prisma.db.user;
  }

  protected toWhere(filters: UserFilters): Prisma.UserWhereInput {
    const search = filters.search?.trim();
    return {
      role: filters.role,
      status: filters.status,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { institutionalEmail: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  /** Nunca incluye datos de credenciales: la tabla de contraseñas ni se consulta. */
  protected toEntity(row: UserRow): User {
    return {
      id: row.id,
      fullName: row.fullName,
      email: row.institutionalEmail,
      role: row.role as UserRole,
      status: row.status as UserStatus,
      createdById: row.createdById,
      createdAt: row.createdAt,
    };
  }
}
