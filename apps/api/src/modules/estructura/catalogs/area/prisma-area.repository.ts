import { Injectable } from '@nestjs/common';
import type {
  Area,
  AreaFilters,
  AreaSortField,
  AreaType,
  CreateAreaInput,
  UpdateAreaInput,
} from '@gns/shared';
import type { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  PrismaReadRepository,
  type ModelDelegate,
} from '../../../../shared/repository/prisma-read.repository';
import { isForeignKeyViolation } from '../../../../shared/database/prisma-error.mapper';
import type { AreaRepository } from './area.repository';

const INCLUDE = { areaLevels: { select: { levelId: true } } } satisfies Prisma.AreaInclude;
type AreaRow = Prisma.AreaGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class PrismaAreaRepository
  extends PrismaReadRepository<AreaRow, Prisma.AreaWhereInput, Area, AreaFilters, AreaSortField>
  implements AreaRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findByName(name: string): Promise<Area | null> {
    const row = await this.prisma.db.area.findUnique({ where: { name }, include: INCLUDE });
    return row ? this.toEntity(row) : null;
  }

  async create({ levelIds, ...input }: CreateAreaInput): Promise<Area> {
    const row = await this.prisma.db.area.create({
      data: { ...input, areaLevels: { create: levelIds.map((levelId) => ({ levelId })) } },
      include: INCLUDE,
    });
    return this.toEntity(row);
  }

  async update(id: string, { levelIds, ...changes }: UpdateAreaInput): Promise<Area> {
    const row = await this.prisma.db.area.update({
      where: { id },
      data: {
        ...changes,
        // Reemplaza el conjunto de niveles.
        ...(levelIds && {
          areaLevels: { deleteMany: {}, create: levelIds.map((levelId) => ({ levelId })) },
        }),
      },
      include: INCLUDE,
    });
    return this.toEntity(row);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.db.areaLevel.deleteMany({ where: { areaId: id } });
      await this.prisma.db.area.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        return false;
      }
      throw error;
    }
  }

  // `ModelDelegate` no admite `include`: se envuelve el delegado para fijarlo en las lecturas.
  protected get delegate(): ModelDelegate<AreaRow, Prisma.AreaWhereInput> {
    const model = this.prisma.db.area;
    return {
      findMany: (args) => model.findMany({ ...args, include: INCLUDE }),
      count: (args) => model.count(args),
      findUnique: (args) => model.findUnique({ ...args, include: INCLUDE }),
    };
  }

  protected toWhere(filters: AreaFilters): Prisma.AreaWhereInput {
    return {
      type: filters.type,
      active: filters.active,
      areaLevels: filters.levelId ? { some: { levelId: filters.levelId } } : undefined,
    };
  }

  protected toEntity(row: AreaRow): Area {
    return {
      id: row.id,
      name: row.name,
      type: row.type as AreaType,
      active: row.active,
      levelIds: row.areaLevels.map((link) => link.levelId).sort(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
