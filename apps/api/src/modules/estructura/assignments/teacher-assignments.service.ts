import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ASSIGNABLE_ROLES,
  TeacherAssignmentStatus,
  UserStatus,
  type CreateTeacherAssignmentInput,
  type ListQuery,
  type MyAssignments,
  type Page,
  type TeacherAssignment,
  type TeacherAssignmentFilters,
  type TeacherAssignmentSortField,
  type UpdateTeacherAssignmentInput,
} from '@gns/shared';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/database/transaction-runner';
import { UsersService } from '../../identidad/users/users.service';
import { AreasService } from '../catalogs/area/areas.service';
import { GradesService } from '../catalogs/grade/grades.service';
import { SchoolYearsService } from '../school-years/school-years.service';
import { groupAssignmentsByGrade } from './my-assignments';
import {
  TEACHER_ASSIGNMENT_REPOSITORY,
  type TeacherAssignmentRepository,
} from './teacher-assignment.repository';

const HOMEROOM_TAKEN_MESSAGE =
  'Ya hay otro docente con la dirección de grupo de ese grado en ese año lectivo';

@Injectable()
export class TeacherAssignmentsService {
  constructor(
    @Inject(TEACHER_ASSIGNMENT_REPOSITORY)
    private readonly repository: TeacherAssignmentRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
    private readonly users: UsersService,
    private readonly grades: GradesService,
    private readonly areas: AreasService,
    private readonly schoolYears: SchoolYearsService,
  ) {}

  /** Sin `schoolYear` en el filtro, el vigente (409 si no hay ninguno). */
  async list(
    query: ListQuery<TeacherAssignmentFilters, TeacherAssignmentSortField>,
  ): Promise<Page<TeacherAssignment>> {
    const schoolYear = query.filters.schoolYear ?? (await this.schoolYears.requireCurrent()).code;
    return this.repository.findPage({ ...query, filters: { ...query.filters, schoolYear } });
  }

  find(id: string): Promise<TeacherAssignment | null> {
    return this.repository.findById(id);
  }

  async create(input: CreateTeacherAssignmentInput): Promise<TeacherAssignment> {
    await this.requireAssignableTeacher(input.teacherId);
    if (!(await this.grades.find(input.gradeId))) {
      throw new RequestValidationException([{ field: 'gradeId', reason: 'no existe' }]);
    }
    if (!(await this.areas.find(input.areaId))) {
      throw new RequestValidationException([{ field: 'areaId', reason: 'no existe' }]);
    }
    const schoolYear = await this.resolveSchoolYear(input.schoolYear);

    const existing = await this.repository.findByNaturalKey(
      input.teacherId,
      input.gradeId,
      input.areaId,
      schoolYear,
    );
    if (existing) {
      throw new ConflictException(
        existing.status === TeacherAssignmentStatus.Withdrawn
          ? `Ya existe una asignación retirada con esos datos (id ${existing.id}); reactívala en lugar de crear otra`
          : 'Ya existe una asignación con ese docente, grado, área y año lectivo',
      );
    }

    return this.transactions.run(async () => {
      if (input.isHomeroomTeacher) {
        await this.requireFreeHomeroom(input.gradeId, schoolYear, input.teacherId);
      }
      return this.repository.create({
        teacherId: input.teacherId,
        gradeId: input.gradeId,
        areaId: input.areaId,
        schoolYear,
        isHomeroomTeacher: input.isHomeroomTeacher,
      });
    });
  }

  /** Solo la dirección de grupo: cambiar docente, grado, área o año es retirar y crear otra. */
  async update(id: string, input: UpdateTeacherAssignmentInput): Promise<TeacherAssignment> {
    const current = await this.get(id);
    if (current.isHomeroomTeacher === input.isHomeroomTeacher) {
      return current;
    }
    return this.transactions.run(async () => {
      // Una asignación retirada no cuenta: se valida al reactivarla.
      if (input.isHomeroomTeacher && current.status === TeacherAssignmentStatus.Active) {
        await this.requireFreeHomeroom(current.grade.id, current.schoolYear, current.teacher.id);
      }
      return this.repository.update(id, { isHomeroomTeacher: input.isHomeroomTeacher });
    });
  }

  /** Retirar conserva el registro; repetir el estado actual es idempotente. */
  async setStatus(id: string, status: TeacherAssignmentStatus): Promise<TeacherAssignment> {
    const current = await this.get(id);
    if (current.status === status) {
      return current;
    }
    if (status === TeacherAssignmentStatus.Withdrawn) {
      return this.repository.update(id, { status });
    }
    // Reactivar repite las validaciones del docente (pudo desactivarse) y de la dirección de grupo.
    await this.requireAssignableTeacher(current.teacher.id);
    return this.transactions.run(async () => {
      if (current.isHomeroomTeacher) {
        await this.requireFreeHomeroom(current.grade.id, current.schoolYear, current.teacher.id);
      }
      return this.repository.update(id, { status });
    });
  }

  /** Asignaciones activas del docente en el año vigente, agrupadas por grado. */
  async listMine(teacherId: string): Promise<MyAssignments> {
    const current = await this.schoolYears.requireCurrent();
    const assignments = await this.repository.findActiveByTeacher(teacherId, current.code);
    return groupAssignmentsByGrade(current.code, assignments);
  }

  private async get(id: string): Promise<TeacherAssignment> {
    const assignment = await this.find(id);
    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada');
    }
    return assignment;
  }

  private async requireAssignableTeacher(teacherId: string): Promise<void> {
    const teacher = await this.users.find(teacherId);
    const reason = !teacher
      ? 'el docente no existe'
      : teacher.status !== UserStatus.Active
        ? 'el docente está inactivo'
        : !ASSIGNABLE_ROLES.includes(teacher.role)
          ? 'el rol del usuario no admite asignaciones'
          : null;
    if (reason) {
      throw new RequestValidationException([{ field: 'teacherId', reason }]);
    }
  }

  /** El año explícito debe estar registrado; sin él se usa el vigente. */
  private async resolveSchoolYear(schoolYear: string | undefined): Promise<string> {
    if (schoolYear === undefined) {
      return (await this.schoolYears.requireCurrent()).code;
    }
    if (!(await this.schoolYears.findByCode(schoolYear))) {
      throw new RequestValidationException([
        { field: 'schoolYear', reason: 'el año lectivo no está registrado' },
      ]);
    }
    return schoolYear;
  }

  /** Un solo director por grado y año: se bloquea el grado para serializar altas simultáneas. */
  private async requireFreeHomeroom(
    gradeId: string,
    schoolYear: string,
    teacherId: string,
  ): Promise<void> {
    await this.repository.lockGrade(gradeId);
    if (await this.repository.findHomeroomOfAnotherTeacher(gradeId, schoolYear, teacherId)) {
      throw new ConflictException(HOMEROOM_TAKEN_MESSAGE);
    }
  }
}
