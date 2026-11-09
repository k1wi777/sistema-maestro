import { Injectable } from '@nestjs/common';
import type {
  CreateLevelInput,
  Level,
  LevelFilters,
  LevelSortField,
  UpdateLevelInput,
} from '@gns/shared';
import type { EducationLevel, Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { PrismaReadRepository } from '../../../../shared/repository/prisma-read.repository';
import type { LevelRepository } from './level.repository';

@Injectable()
export class PrismaLevelRepository
  extends PrismaReadRepository<
    EducationLevel,
    Prisma.EducationLevelWhereInput,
    Level,
    LevelFilters,
    LevelSortField
  >
  implements LevelRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findByName(name: string): Promise<Level | null> {
    const row = await this.prisma.db.educationLevel.findUnique({ where: { name } });
    return row ? this.toEntity(row) : null;
  }

  async create(input: CreateLevelInput): Promise<Level> {
    return this.toEntity(await this.prisma.db.educationLevel.create({ data: input }));
  }

  async update(id: string, changes: UpdateLevelInput): Promise<Level> {
    return this.toEntity(
      await this.prisma.db.educationLevel.update({ where: { id }, data: changes }),
    );
  }

  protected get delegate() {
    return this.prisma.db.educationLevel;
  }

  protected toWhere(): Prisma.EducationLevelWhereInput {
    return {};
  }

  protected toEntity(row: EducationLevel): Level {
    return {
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
