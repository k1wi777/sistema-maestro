import { Injectable } from '@nestjs/common';
import type {
  AcademicPeriod,
  AcademicPeriodFilters,
  AcademicPeriodSortField,
  CreateAcademicPeriodInput,
  UpdateAcademicPeriodInput,
} from '@gns/shared';
import type {
  AcademicPeriod as AcademicPeriodRow,
  Prisma,
} from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { PrismaReadRepository } from '../../../../shared/repository/prisma-read.repository';
import type { AcademicPeriodRepository } from './academic-period.repository';

/** Columna `date`: Prisma la maneja como `Date` en UTC; la API la expone como `AAAA-MM-DD`. */
const toDate = (value: string | null | undefined): Date | null | undefined =>
  typeof value === 'string' ? new Date(`${value}T00:00:00.000Z`) : value;
const toCalendarDate = (value: Date | null): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

@Injectable()
export class PrismaAcademicPeriodRepository
  extends PrismaReadRepository<
    AcademicPeriodRow,
    Prisma.AcademicPeriodWhereInput,
    AcademicPeriod,
    AcademicPeriodFilters,
    AcademicPeriodSortField
  >
  implements AcademicPeriodRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findBySchoolYearAndNumber(
    schoolYear: string,
    number: number,
  ): Promise<AcademicPeriod | null> {
    const row = await this.prisma.db.academicPeriod.findUnique({
      where: { schoolYear_number: { schoolYear, number } },
    });
    return row ? this.toEntity(row) : null;
  }

  async create(input: CreateAcademicPeriodInput): Promise<AcademicPeriod> {
    const row = await this.prisma.db.academicPeriod.create({
      data: {
        schoolYear: input.schoolYear,
        number: input.number,
        startDate: toDate(input.startDate),
        endDate: toDate(input.endDate),
      },
    });
    return this.toEntity(row);
  }

  async update(id: string, changes: UpdateAcademicPeriodInput): Promise<AcademicPeriod> {
    const row = await this.prisma.db.academicPeriod.update({
      where: { id },
      data: { startDate: toDate(changes.startDate), endDate: toDate(changes.endDate) },
    });
    return this.toEntity(row);
  }

  // Con `schoolYear desc` el desempate por id no ordenaría los números del año.
  protected override tieBreakers(field: AcademicPeriodSortField): Record<string, 'asc' | 'desc'>[] {
    return field === 'schoolYear'
      ? [{ number: 'asc' }, { id: 'asc' }]
      : [{ schoolYear: 'desc' }, { id: 'asc' }];
  }

  protected get delegate() {
    return this.prisma.db.academicPeriod;
  }

  protected toWhere(filters: AcademicPeriodFilters): Prisma.AcademicPeriodWhereInput {
    return { schoolYear: filters.schoolYear };
  }

  protected toEntity(row: AcademicPeriodRow): AcademicPeriod {
    return {
      id: row.id,
      schoolYear: row.schoolYear,
      number: row.number,
      startDate: toCalendarDate(row.startDate),
      endDate: toCalendarDate(row.endDate),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
