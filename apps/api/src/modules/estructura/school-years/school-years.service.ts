import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ACADEMIC_PERIODS_PER_YEAR,
  type CreateSchoolYearInput,
  type ListQuery,
  type Page,
  type SchoolYear,
  type SchoolYearFilters,
  type SchoolYearSortField,
} from '@gns/shared';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/database/transaction-runner';
import { SCHOOL_YEAR_REPOSITORY, type SchoolYearRepository } from './school-year.repository';

export const NO_CURRENT_SCHOOL_YEAR_MESSAGE =
  'No hay un año lectivo vigente; administración debe marcar uno';

@Injectable()
export class SchoolYearsService {
  constructor(
    @Inject(SCHOOL_YEAR_REPOSITORY) private readonly repository: SchoolYearRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
  ) {}

  list(query: ListQuery<SchoolYearFilters, SchoolYearSortField>): Promise<Page<SchoolYear>> {
    return this.repository.findPage(query);
  }

  find(id: string): Promise<SchoolYear | null> {
    return this.repository.findById(id);
  }

  findByCode(code: string): Promise<SchoolYear | null> {
    return this.repository.findByCode(code);
  }

  /** Año vigente o 409: la ruta existe y lo que falta es un estado que administración debe fijar. */
  async requireCurrent(): Promise<SchoolYear> {
    const current = await this.repository.findCurrent();
    if (!current) {
      throw new ConflictException(NO_CURRENT_SCHOOL_YEAR_MESSAGE);
    }
    return current;
  }

  async create(input: CreateSchoolYearInput): Promise<SchoolYear> {
    if (await this.repository.findByCode(input.code)) {
      throw new ConflictException('Ya existe un año lectivo con ese código');
    }
    return this.repository.create(input);
  }

  /** Marcar el año que ya es vigente es idempotente. */
  async setCurrent(id: string): Promise<SchoolYear> {
    const year = await this.find(id);
    if (!year) {
      throw new NotFoundException('Año lectivo no encontrado');
    }
    if (year.isCurrent) {
      return year;
    }
    if ((await this.repository.countPeriods(year.code)) < ACADEMIC_PERIODS_PER_YEAR) {
      throw new ConflictException(
        `El año lectivo no tiene sus ${ACADEMIC_PERIODS_PER_YEAR} periodos registrados`,
      );
    }
    return this.transactions.run(() => this.repository.markCurrent(id));
  }
}
