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
import { isForeignKeyViolation } from '../../../../shared/database/prisma-error.mapper';
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

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.db.group.deleteMany({ where: { gradeId: id } });
      await this.prisma.db.grade.delete({ where: { id } });
      return true;
    } catch (error) {
      // P2003: apareció una referencia entre la comprobación de uso y el borrado.
      if (isForeignKeyViolation(error)) {
        return false;
      }
      throw error;
    }
  }

  async findIdsByCoordinator(coordinatorId: string): Promise<string[]> {
    const rows = await this.prisma.db.grade.findMany({
      where: { coordinatorId },
      select: { id: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => row.id);
  }

  async findExistingIds(ids: string[]): Promise<string[]> {
    const rows = await this.prisma.db.grade.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async setCoordinatorGrades(coordinatorId: string, gradeIds: string[]): Promise<void> {
    await this.prisma.db.grade.updateMany({
      where: { coordinatorId, id: { notIn: gradeIds } },
      data: { coordinatorId: null },
    });
    await this.prisma.db.grade.updateMany({
      where: { id: { in: gradeIds } },
      data: { coordinatorId },
    });
  }

  protected get delegate() {
    return this.prisma.db.grade;
  }

  protected toWhere(filters: GradeFilters): Prisma.GradeWhereInput {
    return { levelId: filters.levelId, active: filters.active };
  }

  protected toEntity(row: GradeRow): Grade {
    return {
      id: row.id,
      levelId: row.levelId,
      name: row.name,
      sortOrder: row.sortOrder,
      active: row.active,
      coordinatorId: row.coordinatorId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
