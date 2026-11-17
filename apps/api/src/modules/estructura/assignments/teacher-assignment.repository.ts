import type {
  TeacherAssignment,
  TeacherAssignmentFilters,
  TeacherAssignmentSortField,
  TeacherAssignmentStatus,
} from '@gns/shared';
import type { ReadRepository } from '../../../shared/repository/repository';
import type { GroupRoster, MyGroup } from './group-roster';

/** Docente del alcance de un plan: solo id y nombre (nunca correo ni otros datos). */
export interface TeacherInScope {
  id: string;
  fullName: string;
}

export interface NewTeacherAssignment {
  teacherId: string;
  groupId: string;
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
    groupId: string,
    areaId: string,
    schoolYear: string,
  ): Promise<TeacherAssignment | null>;
  /** Otra asignación activa (distinta de `exceptId`) que dirige el grupo en el año, si existe. */
  findHomeroomInGroup(
    groupId: string,
    schoolYear: string,
    exceptId: string | null,
  ): Promise<TeacherAssignment | null>;
  /** Bloquea la fila del grupo hasta el fin de la transacción para serializar altas de director. */
  lockGroup(groupId: string): Promise<void>;
  /**
   * Marca la asignación activa más antigua del docente en el grupo y año (la dirección de grupo
   * que se traslada al retirar la que la tenía). `false` si no tiene ninguna activa.
   */
  markOldestActiveAsHomeroom(
    teacherId: string,
    groupId: string,
    schoolYear: string,
  ): Promise<boolean>;
  findActiveByTeacher(teacherId: string, schoolYear: string): Promise<TeacherAssignment[]>;
  /** Asignaciones activas de todos los docentes en el año, sin paginar. */
  findActiveByYear(schoolYear: string): Promise<TeacherAssignment[]>;
  /**
   * Docentes activos por nombre: sin área, todos los de rol docente; con área, los usuarios
   * activos con asignación activa en esa área y año.
   */
  findActiveTeachers(areaId: string | null, schoolYear: string): Promise<TeacherInScope[]>;
  /** Participantes, director(a) y coordinadora del grupo en el año; `null` si el grupo no existe. */
  findGroupRoster(groupId: string, schoolYear: string): Promise<GroupRoster | null>;
  /** Grupos donde el docente tiene asignaciones activas en el año, con sus áreas. */
  findMyGroups(teacherId: string, schoolYear: string): Promise<MyGroup[]>;
  create(input: NewTeacherAssignment): Promise<TeacherAssignment>;
  update(id: string, changes: TeacherAssignmentChanges): Promise<TeacherAssignment>;
}

export const TEACHER_ASSIGNMENT_REPOSITORY = Symbol('TEACHER_ASSIGNMENT_REPOSITORY');
