import { Injectable } from '@nestjs/common';
import type {
  CreateSchoolYearInput,
  SchoolYear,
  SchoolYearFilters,
  SchoolYearSortField,
} from '@gns/shared';
import type { Prisma, SchoolYear as SchoolYearRow } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { PrismaReadRepository } from '../../../shared/repository/prisma-read.repository';
import type { SchoolYearRepository } from './school-year.repository';

@Injectable()
export class PrismaSchoolYearRepository
  extends PrismaReadRepository<
    SchoolYearRow,
    Prisma.SchoolYearWhereInput,
    SchoolYear,
    SchoolYearFilters,
    SchoolYearSortField
  >
  implements SchoolYearRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findByCode(code: string): Promise<SchoolYear | null> {
    const row = await this.prisma.db.schoolYear.findUnique({ where: { code } });
    return row ? this.toEntity(row) : null;
  }

  async findCurrent(): Promise<SchoolYear | null> {
    const row = await this.prisma.db.schoolYear.findUnique({ where: { isCurrent: true } });
    return row ? this.toEntity(row) : null;
  }

  countPeriods(code: string): Promise<number> {
    return this.prisma.db.academicPeriod.count({ where: { schoolYear: code } });
  }

  async create(input: CreateSchoolYearInput): Promise<SchoolYear> {
    return this.toEntity(await this.prisma.db.schoolYear.create({ data: { code: input.code } }));
  }

  // `vigente` es true o NULL (nunca false): el UNIQUE admite un solo true. Se libera el
  // anterior antes de marcar este; ambas escrituras comparten la transacción de la petición.
  async markCurrent(id: string): Promise<SchoolYear> {
    await this.prisma.db.schoolYear.updateMany({
      where: { isCurrent: true, id: { not: id } },
      data: { isCurrent: null },
    });
    return this.toEntity(
      await this.prisma.db.schoolYear.update({ where: { id }, data: { isCurrent: true } }),
    );
  }

  protected get delegate() {
    return this.prisma.db.schoolYear;
  }

  protected toWhere(filters: SchoolYearFilters): Prisma.SchoolYearWhereInput {
    if (filters.isCurrent === undefined) {
      return {};
    }
    return filters.isCurrent ? { isCurrent: true } : { isCurrent: null };
  }

  protected toEntity(row: SchoolYearRow): SchoolYear {
    return {
      id: row.id,
      code: row.code,
      isCurrent: row.isCurrent === true,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
