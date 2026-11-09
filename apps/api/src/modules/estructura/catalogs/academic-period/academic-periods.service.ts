import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  periodDatesOrdered,
  type AcademicPeriod,
  type AcademicPeriodFilters,
  type AcademicPeriodSortField,
  type CreateAcademicPeriodInput,
  type ListQuery,
  type Page,
  type UpdateAcademicPeriodInput,
} from '@gns/shared';
import { RequestValidationException } from '../../../../core/http/request-validation.exception';
import { SchoolYearsService } from '../../school-years/school-years.service';
import {
  ACADEMIC_PERIOD_REPOSITORY,
  type AcademicPeriodRepository,
} from './academic-period.repository';

@Injectable()
export class AcademicPeriodsService {
  constructor(
    @Inject(ACADEMIC_PERIOD_REPOSITORY) private readonly repository: AcademicPeriodRepository,
    private readonly schoolYears: SchoolYearsService,
  ) {}

  list(
    query: ListQuery<AcademicPeriodFilters, AcademicPeriodSortField>,
  ): Promise<Page<AcademicPeriod>> {
    return this.repository.findPage(query);
  }

  find(id: string): Promise<AcademicPeriod | null> {
    return this.repository.findById(id);
  }

  async create(input: CreateAcademicPeriodInput): Promise<AcademicPeriod> {
    // El año se registra antes que sus periodos.
    if (!(await this.schoolYears.findByCode(input.schoolYear))) {
      throw new RequestValidationException([
        { field: 'schoolYear', reason: 'el año lectivo no está registrado' },
      ]);
    }
    if (await this.repository.findBySchoolYearAndNumber(input.schoolYear, input.number)) {
      throw new ConflictException('Ya existe ese periodo en el año lectivo');
    }
    return this.repository.create(input);
  }

  async update(id: string, input: UpdateAcademicPeriodInput): Promise<AcademicPeriod> {
    const current = await this.find(id);
    if (!current) {
      throw new NotFoundException('Periodo académico no encontrado');
    }
    // Con una sola fecha en el cuerpo, se compara contra la guardada.
    const merged = {
      startDate: input.startDate === undefined ? current.startDate : input.startDate,
      endDate: input.endDate === undefined ? current.endDate : input.endDate,
    };
    if (!periodDatesOrdered(merged)) {
      throw new RequestValidationException([
        { field: 'startDate', reason: 'la fecha de inicio no puede ser posterior a la de fin' },
      ]);
    }
    return this.repository.update(id, input);
  }
}
