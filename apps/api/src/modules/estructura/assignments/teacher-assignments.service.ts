import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import {
  ASSIGNABLE_ROLES,
  AuditLogType,
  TeacherAssignmentStatus,
  UserRole,
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
import type { RequestUser } from '../../../core/audit/request-user';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/database/transaction-runner';
import { AuditLogService } from '../../auditoria/audit-log.service';
import {
  UserRoleChangeEffects,
  type UserRoleChange,
  type UserRoleChangeEffect,
} from '../../identidad/users/user-role-change-effects';
import { UsersService } from '../../identidad/users/users.service';
import { AreasService } from '../catalogs/area/areas.service';
import { GradesService } from '../catalogs/grade/grades.service';
import { GroupsService } from '../catalogs/group/groups.service';
import { SchoolYearsService } from '../school-years/school-years.service';
import type { GroupRoster, MyGroup } from './group-roster';
import { groupAssignmentsByGrade } from './my-assignments';
import {
  TEACHER_ASSIGNMENT_REPOSITORY,
  type TeacherAssignmentRepository,
  type TeacherInScope,
} from './teacher-assignment.repository';

const homeroomTakenMessage = (groupName: string, teacherName: string) =>
  `${groupName} ya tiene director(a) de grupo: ${teacherName}`;

@Injectable()
export class TeacherAssignmentsService implements UserRoleChangeEffect, OnModuleInit {
  constructor(
    @Inject(TEACHER_ASSIGNMENT_REPOSITORY)
    private readonly repository: TeacherAssignmentRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
    private readonly users: UsersService,
    private readonly groups: GroupsService,
    private readonly grades: GradesService,
    private readonly areas: AreasService,
    private readonly schoolYears: SchoolYearsService,
    private readonly audit: AuditLogService,
    private readonly roleEffects: UserRoleChangeEffects,
  ) {}

  onModuleInit(): void {
    this.roleEffects.register(this);
  }

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

  async create(user: RequestUser, input: CreateTeacherAssignmentInput): Promise<TeacherAssignment> {
    await this.requireInScope(user, input.groupId);
    await this.requireAssignableTeacher(input.teacherId);
    await this.requireOpenGroupAndArea(input.groupId, input.areaId);
    const schoolYear = await this.resolveSchoolYear(input.schoolYear);

    const existing = await this.repository.findByNaturalKey(
      input.teacherId,
      input.groupId,
      input.areaId,
      schoolYear,
    );
    if (existing) {
      throw new ConflictException(
        existing.status === TeacherAssignmentStatus.Withdrawn
          ? `Ya existe una asignación retirada con esos datos (id ${existing.id}); reactívala en lugar de crear otra`
          : 'Ya existe una asignación con ese docente, grupo, área y año lectivo',
      );
    }

    return this.transactions.run(async () => {
      if (input.isHomeroomTeacher) {
        await this.requireFreeHomeroom(input.groupId, schoolYear, null);
      }
      return this.repository.create({
        teacherId: input.teacherId,
        groupId: input.groupId,
        areaId: input.areaId,
        schoolYear,
        isHomeroomTeacher: input.isHomeroomTeacher,
      });
    });
  }

  /** Solo la dirección de grupo: cambiar docente, grupo, área o año es retirar y crear otra. */
  async update(
    user: RequestUser,
    id: string,
    input: UpdateTeacherAssignmentInput,
  ): Promise<TeacherAssignment> {
    const current = await this.get(id);
    await this.requireInScope(user, current.group.id);
    if (current.isHomeroomTeacher === input.isHomeroomTeacher) {
      return current;
    }
    return this.transactions.run(async () => {
      // Una asignación retirada no cuenta: se valida al reactivarla.
      if (input.isHomeroomTeacher && current.status === TeacherAssignmentStatus.Active) {
        await this.requireFreeHomeroom(current.group.id, current.schoolYear, id);
      }
      return this.repository.update(id, { isHomeroomTeacher: input.isHomeroomTeacher });
    });
  }

  /** Retirar conserva el registro; repetir el estado actual es idempotente. */
  async setStatus(
    user: RequestUser,
    id: string,
    status: TeacherAssignmentStatus,
  ): Promise<TeacherAssignment> {
    const current = await this.get(id);
    await this.requireInScope(user, current.group.id);
    if (current.status === status) {
      return current;
    }
    if (status === TeacherAssignmentStatus.Withdrawn) {
      return this.withdraw(current);
    }
    // Reactivar repite las validaciones del docente (pudo desactivarse), del grupo y el área
    // (pudieron desactivarse) y de la dirección de grupo.
    await this.requireAssignableTeacher(current.teacher.id);
    await this.requireOpenGroupAndArea(current.group.id, current.area.id);
    return this.transactions.run(async () => {
      if (current.isHomeroomTeacher) {
        await this.requireFreeHomeroom(current.group.id, current.schoolYear, id);
      }
      return this.repository.update(id, { status });
    });
  }

  /**
   * Efecto de un cambio de rol (#115): quien deja de ser docente pierde sus asignaciones activas
   * de todos los años y, con ellas, la dirección de grupo; no se traslada a nadie ni se borra
   * nada. Cada retiro queda en la bitácora con los grupos y áreas por nombre.
   */
  async onRoleChange({ userId, from, to, actor }: UserRoleChange): Promise<void> {
    if (from !== UserRole.Teacher || to === UserRole.Teacher) {
      return;
    }
    const active = await this.repository.findAllActiveByTeacher(userId);
    if (active.length === 0) {
      return;
    }
    for (const assignment of active) {
      await this.repository.update(assignment.id, {
        status: TeacherAssignmentStatus.Withdrawn,
        isHomeroomTeacher: false,
      });
    }
    const detail = active
      .map(
        (item) =>
          `${item.group.name} · ${item.area.name} (${item.schoolYear})${item.isHomeroomTeacher ? ' · dirección de grupo' : ''}`,
      )
      .join('; ');
    await this.audit.record({
      userId: actor.id,
      role: actor.role,
      type: AuditLogType.Users,
      action: 'Retiró asignaciones por cambio de rol',
      entity: 'usuario',
      entityId: userId,
      detail,
    });
  }

  /** Asignaciones activas del docente en el año vigente, agrupadas por grado. */
  async listMine(teacherId: string): Promise<MyAssignments> {
    const current = await this.schoolYears.requireCurrent();
    const assignments = await this.repository.findActiveByTeacher(teacherId, current.code);
    return groupAssignmentsByGrade(current.code, assignments);
  }

  /**
   * Participantes, director(a) y coordinadora de un grupo en un año: única fuente de esas
   * relaciones para el diario colaborativo. `null` si el grupo no existe.
   */
  groupRoster(groupId: string, schoolYear: string): Promise<GroupRoster | null> {
    return this.repository.findGroupRoster(groupId, schoolYear);
  }

  /** Grupos del docente en el año (asignaciones activas) con las áreas que tiene en cada uno. */
  myGroups(teacherId: string, schoolYear: string): Promise<MyGroup[]> {
    return this.repository.findMyGroups(teacherId, schoolYear);
  }

  /** Asignaciones activas de todos los docentes del año, sin paginar (informes de coordinación). */
  listActive(schoolYear: string): Promise<TeacherAssignment[]> {
    return this.repository.findActiveByYear(schoolYear);
  }

  /**
   * Docentes del alcance de un plan de formación: todos los activos si `areaId` es nulo, o los
   * que tienen una asignación activa en esa área y año. Solo id y nombre.
   */
  teachersInScope(areaId: string | null, schoolYear: string): Promise<TeacherInScope[]> {
    return this.repository.findActiveTeachers(areaId, schoolYear);
  }

  private async get(id: string): Promise<TeacherAssignment> {
    const assignment = await this.find(id);
    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada');
    }
    return assignment;
  }

  /**
   * La coordinadora asigna, edita y retira solo en los grupos de sus grados (403 en otro caso);
   * administración, en cualquiera. Un grupo inexistente no se juzga aquí: lo rechaza la
   * validación del grupo (400) o la búsqueda de la asignación (404).
   */
  private async requireInScope(user: RequestUser, groupId: string): Promise<void> {
    if (user.role !== UserRole.Coordinator) {
      return;
    }
    const group = await this.groups.find(groupId);
    const grade = group ? await this.grades.find(group.gradeId) : null;
    if (grade && grade.coordinatorId !== user.id) {
      throw new ForbiddenException('Solo asignas en los grupos de tus grados');
    }
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

  /**
   * Retira conservando el registro. Si la fila marcaba la dirección de grupo, la marca se quita
   * y, si el mismo docente conserva otra asignación activa en el grupo y año, se le traslada;
   * si no, el grupo queda sin director(a).
   */
  private withdraw(current: TeacherAssignment): Promise<TeacherAssignment> {
    return this.transactions.run(async () => {
      if (!current.isHomeroomTeacher) {
        return this.repository.update(current.id, { status: TeacherAssignmentStatus.Withdrawn });
      }
      await this.repository.lockGroup(current.group.id);
      const withdrawn = await this.repository.update(current.id, {
        status: TeacherAssignmentStatus.Withdrawn,
        isHomeroomTeacher: false,
      });
      await this.repository.markOldestActiveAsHomeroom(
        current.teacher.id,
        current.group.id,
        current.schoolYear,
      );
      return withdrawn;
    });
  }

  /** El grupo y su grado deben existir y estar activos; el área, existir, estar activa y ser del nivel. */
  private async requireOpenGroupAndArea(groupId: string, areaId: string): Promise<void> {
    const group = await this.groups.find(groupId);
    if (!group) {
      throw new RequestValidationException([{ field: 'groupId', reason: 'no existe' }]);
    }
    if (!group.active) {
      throw new RequestValidationException([
        { field: 'groupId', reason: 'el grupo está inactivo' },
      ]);
    }
    const grade = await this.grades.find(group.gradeId);
    if (!grade?.active) {
      throw new RequestValidationException([
        { field: 'groupId', reason: 'el grado está inactivo' },
      ]);
    }
    const area = await this.areas.find(areaId);
    if (!area) {
      throw new RequestValidationException([{ field: 'areaId', reason: 'no existe' }]);
    }
    if (!area.active) {
      throw new RequestValidationException([{ field: 'areaId', reason: 'el área está inactiva' }]);
    }
    if (!area.levelIds.includes(grade.levelId)) {
      throw new RequestValidationException([
        { field: 'areaId', reason: 'el área no pertenece al nivel del grupo' },
      ]);
    }
  }

  /**
   * Un solo director por grupo y año: se bloquea el grupo para serializar altas simultáneas y
   * cualquier otra fila activa marcada (también del mismo docente) da 409.
   */
  private async requireFreeHomeroom(
    groupId: string,
    schoolYear: string,
    exceptId: string | null,
  ): Promise<void> {
    await this.repository.lockGroup(groupId);
    const other = await this.repository.findHomeroomInGroup(groupId, schoolYear, exceptId);
    if (other) {
      throw new ConflictException(homeroomTakenMessage(other.group.name, other.teacher.fullName));
    }
  }
}
