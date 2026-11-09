import type {
  CreateGradeInput,
  Grade,
  GradeFilters,
  GradeSortField,
  UpdateGradeInput,
} from '@gns/shared';
import type { ReadRepository } from '../../../../shared/repository/repository';

export interface GradeRepository extends ReadRepository<Grade, GradeFilters, GradeSortField> {
  findByName(name: string): Promise<Grade | null>;
  create(input: CreateGradeInput): Promise<Grade>;
  update(id: string, changes: UpdateGradeInput): Promise<Grade>;
}

export const GRADE_REPOSITORY = Symbol('GRADE_REPOSITORY');
