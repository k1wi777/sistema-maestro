import { Injectable } from '@nestjs/common';
import type {
  Area,
  AreaFilters,
  AreaSortField,
  AreaType,
  CreateAreaInput,
  UpdateAreaInput,
} from '@gns/shared';
import type { Area as AreaRow, Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { PrismaReadRepository } from '../../../../shared/repository/prisma-read.repository';
import type { AreaRepository } from './area.repository';

@Injectable()
export class PrismaAreaRepository
  extends PrismaReadRepository<AreaRow, Prisma.AreaWhereInput, Area, AreaFilters, AreaSortField>
  implements AreaRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findByName(name: string): Promise<Area | null> {
    const row = await this.prisma.db.area.findUnique({ where: { name } });
    return row ? this.toEntity(row) : null;
  }

  async create(input: CreateAreaInput): Promise<Area> {
    return this.toEntity(await this.prisma.db.area.create({ data: input }));
  }

  async update(id: string, changes: UpdateAreaInput): Promise<Area> {
    return this.toEntity(await this.prisma.db.area.update({ where: { id }, data: changes }));
  }

  protected get delegate() {
    return this.prisma.db.area;
  }

  protected toWhere(filters: AreaFilters): Prisma.AreaWhereInput {
    return { type: filters.type };
  }

  protected toEntity(row: AreaRow): Area {
    return {
      id: row.id,
      name: row.name,
      type: row.type as AreaType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
