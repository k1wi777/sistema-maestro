import { Injectable } from '@nestjs/common';
import type {
  CreateGradeInput,
  Grade,
  GradeFilters,
  GradeSortField,
  UpdateGradeInput,
} from '@gns/shared';
import type { Grade as GradeRow, Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { PrismaReadRepository } from '../../../../shared/repository/prisma-read.repository';
import type { GradeRepository } from './grade.repository';

@Injectable()
export class PrismaGradeRepository
  extends PrismaReadRepository<
    GradeRow,
    Prisma.GradeWhereInput,
    Grade,
    GradeFilters,
    GradeSortField
  >
  implements GradeRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findByName(name: string): Promise<Grade | null> {
    const row = await this.prisma.db.grade.findUnique({ where: { name } });
    return row ? this.toEntity(row) : null;
  }

  async create(input: CreateGradeInput): Promise<Grade> {
    return this.toEntity(await this.prisma.db.grade.create({ data: input }));
  }

  async update(id: string, changes: UpdateGradeInput): Promise<Grade> {
    return this.toEntity(await this.prisma.db.grade.update({ where: { id }, data: changes }));
  }

  protected get delegate() {
    return this.prisma.db.grade;
  }

  protected toWhere(filters: GradeFilters): Prisma.GradeWhereInput {
    return { levelId: filters.levelId };
  }

  protected toEntity(row: GradeRow): Grade {
    return {
      id: row.id,
      levelId: row.levelId,
      name: row.name,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
