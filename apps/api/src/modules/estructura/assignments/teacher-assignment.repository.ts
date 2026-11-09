import type {
  TeacherAssignment,
  TeacherAssignmentFilters,
  TeacherAssignmentSortField,
  TeacherAssignmentStatus,
} from '@gns/shared';
import type { ReadRepository } from '../../../shared/repository/repository';

export interface NewTeacherAssignment {
  teacherId: string;
  gradeId: string;
  areaId: string;
  schoolYear: string;
  isHomeroomTeacher: boolean;
}

export interface TeacherAssignmentChanges {
  isHomeroomTeacher?: boolean;
  status?: TeacherAssignmentStatus;
}

export interface TeacherAssignmentRepository extends ReadRepository<
  TeacherAssignment,
  TeacherAssignmentFilters,
  TeacherAssignmentSortField
> {
  findByNaturalKey(
    teacherId: string,
    gradeId: string,
    areaId: string,
    schoolYear: string,
  ): Promise<TeacherAssignment | null>;
  /** Asignación activa de otro docente que dirige el grado en el año, si existe. */
  findHomeroomOfAnotherTeacher(
    gradeId: string,
    schoolYear: string,
    teacherId: string,
  ): Promise<TeacherAssignment | null>;
  /** Bloquea la fila del grado hasta el fin de la transacción para serializar altas de director. */
  lockGrade(gradeId: string): Promise<void>;
  findActiveByTeacher(teacherId: string, schoolYear: string): Promise<TeacherAssignment[]>;
  create(input: NewTeacherAssignment): Promise<TeacherAssignment>;
  update(id: string, changes: TeacherAssignmentChanges): Promise<TeacherAssignment>;
}

export const TEACHER_ASSIGNMENT_REPOSITORY = Symbol('TEACHER_ASSIGNMENT_REPOSITORY');
