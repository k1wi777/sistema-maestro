import type {
  CreateSchoolYearInput,
  SchoolYear,
  SchoolYearFilters,
  SchoolYearSortField,
} from '@gns/shared';
import type { ReadRepository } from '../../../shared/repository/repository';

export interface SchoolYearRepository extends ReadRepository<
  SchoolYear,
  SchoolYearFilters,
  SchoolYearSortField
> {
  findByCode(code: string): Promise<SchoolYear | null>;
  findCurrent(): Promise<SchoolYear | null>;
  /** Periodos académicos registrados del año (el único `(año, número)` impide repetidos). */
  countPeriods(code: string): Promise<number>;
  create(input: CreateSchoolYearInput): Promise<SchoolYear>;
  /** Deja `id` como único vigente: quita la marca al anterior y se la pone a este. */
  markCurrent(id: string): Promise<SchoolYear>;
}

export const SCHOOL_YEAR_REPOSITORY = Symbol('SCHOOL_YEAR_REPOSITORY');
