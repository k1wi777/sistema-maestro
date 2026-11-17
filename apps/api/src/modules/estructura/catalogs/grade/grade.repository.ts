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
  /** Borra el grado y sus grupos (el servicio ya comprobó que no está en uso). `false` si una referencia nueva lo impidió. */
  delete(id: string): Promise<boolean>;
  /** Ids de los grados que coordina la usuaria, por orden del grado. */
  findIdsByCoordinator(coordinatorId: string): Promise<string[]>;
  /** Ids existentes entre los pedidos. */
  findExistingIds(ids: string[]): Promise<string[]>;
  /** Deja a la coordinadora exactamente con esos grados (quitándolos a quien los tuviera). */
  setCoordinatorGrades(coordinatorId: string, gradeIds: string[]): Promise<void>;
}

export const GRADE_REPOSITORY = Symbol('GRADE_REPOSITORY');
