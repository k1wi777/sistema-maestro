import { Injectable } from '@nestjs/common';
import type {
  CreateGroupInput,
  Group,
  GroupFilters,
  GroupSortField,
  UpdateGroupInput,
} from '@gns/shared';
import type { Group as GroupRow, Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { isForeignKeyViolation } from '../../../../shared/database/prisma-error.mapper';
import { PrismaReadRepository } from '../../../../shared/repository/prisma-read.repository';
import type { GroupRepository } from './group.repository';

@Injectable()
export class PrismaGroupRepository
  extends PrismaReadRepository<
    GroupRow,
    Prisma.GroupWhereInput,
    Group,
    GroupFilters,
    GroupSortField
  >
  implements GroupRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findByName(gradeId: string, name: string): Promise<Group | null> {
    const row = await this.prisma.db.group.findUnique({
      where: { gradeId_name: { gradeId, name } },
    });
    return row ? this.toEntity(row) : null;
  }

  async create(input: CreateGroupInput): Promise<Group> {
    return this.toEntity(await this.prisma.db.group.create({ data: input }));
  }

  async update(id: string, changes: UpdateGroupInput): Promise<Group> {
    return this.toEntity(await this.prisma.db.group.update({ where: { id }, data: changes }));
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.db.group.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        return false;
      }
      throw error;
    }
  }

  protected get delegate() {
    return this.prisma.db.group;
  }

  protected toWhere(filters: GroupFilters): Prisma.GroupWhereInput {
    return { gradeId: filters.gradeId, active: filters.active };
  }

  protected toEntity(row: GroupRow): Group {
    return {
      id: row.id,
      gradeId: row.gradeId,
      name: row.name,
      active: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
