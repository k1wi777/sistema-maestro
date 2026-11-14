import type {
  TeacherAssignment,
  TeacherAssignmentFilters,
  TeacherAssignmentSortField,
  TeacherAssignmentStatus,
} from '@gns/shared';
import type { ReadRepository } from '../../../shared/repository/repository';

/** Docente del alcance de un plan: solo id y nombre (nunca correo ni otros datos). */
export interface TeacherInScope {
  id: string;
  fullName: string;
}

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
  /** Asignaciones activas de todos los docentes en el año, sin paginar. */
  findActiveByYear(schoolYear: string): Promise<TeacherAssignment[]>;
  /**
   * Docentes activos por nombre: sin área, todos los de rol docente; con área, los usuarios
   * activos con asignación activa en esa área y año.
   */
  findActiveTeachers(areaId: string | null, schoolYear: string): Promise<TeacherInScope[]>;
  create(input: NewTeacherAssignment): Promise<TeacherAssignment>;
  update(id: string, changes: TeacherAssignmentChanges): Promise<TeacherAssignment>;
}

export const TEACHER_ASSIGNMENT_REPOSITORY = Symbol('TEACHER_ASSIGNMENT_REPOSITORY');
