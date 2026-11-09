import type {
  AcademicPeriod,
  AcademicPeriodFilters,
  AcademicPeriodSortField,
  CreateAcademicPeriodInput,
  UpdateAcademicPeriodInput,
} from '@gns/shared';
import type { ReadRepository } from '../../../../shared/repository/repository';

export interface AcademicPeriodRepository extends ReadRepository<
  AcademicPeriod,
  AcademicPeriodFilters,
  AcademicPeriodSortField
> {
  findBySchoolYearAndNumber(schoolYear: string, number: number): Promise<AcademicPeriod | null>;
  create(input: CreateAcademicPeriodInput): Promise<AcademicPeriod>;
  /** Solo las fechas cambian: el año y el número identifican al periodo. */
  update(id: string, changes: UpdateAcademicPeriodInput): Promise<AcademicPeriod>;
}

export const ACADEMIC_PERIOD_REPOSITORY = Symbol('ACADEMIC_PERIOD_REPOSITORY');
