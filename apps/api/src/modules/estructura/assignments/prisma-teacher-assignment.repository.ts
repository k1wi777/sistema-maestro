import { ConflictException, Injectable } from '@nestjs/common';
import {
  TeacherAssignmentStatus,
  UserRole,
  UserStatus,
  type AreaType,
  type TeacherAssignment,
  type TeacherAssignmentFilters,
  type TeacherAssignmentSortField,
} from '@gns/shared';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { isUniqueViolation } from '../../../shared/database/prisma-error.mapper';
import {
  PrismaReadRepository,
  type ModelDelegate,
} from '../../../shared/repository/prisma-read.repository';
import type {
  NewTeacherAssignment,
  TeacherAssignmentChanges,
  TeacherAssignmentRepository,
  TeacherInScope,
} from './teacher-assignment.repository';

// Datos anidados que evitan que el cliente cruce cuatro catálogos; nunca el correo.
const INCLUDE = {
  teacher: { select: { id: true, fullName: true, status: true } },
  group: {
    include: { grade: { include: { level: { select: { id: true, name: true } } } } },
  },
  area: { select: { id: true, name: true, type: true } },
} satisfies Prisma.TeacherAssignmentInclude;

type AssignmentRow = Prisma.TeacherAssignmentGetPayload<{ include: typeof INCLUDE }>;

const HOMEROOM_RACE_MESSAGE =
  'El grupo ya tiene director(a) de grupo en ese año lectivo: otra petición se adelantó';

@Injectable()
export class PrismaTeacherAssignmentRepository
  extends PrismaReadRepository<
    AssignmentRow,
    Prisma.TeacherAssignmentWhereInput,
    TeacherAssignment,
    TeacherAssignmentFilters,
    TeacherAssignmentSortField
  >
  implements TeacherAssignmentRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findByNaturalKey(
    teacherId: string,
    groupId: string,
    areaId: string,
    schoolYear: string,
  ): Promise<TeacherAssignment | null> {
    const row = await this.prisma.db.teacherAssignment.findUnique({
      where: { teacherId_groupId_areaId_schoolYear: { teacherId, groupId, areaId, schoolYear } },
      include: INCLUDE,
    });
    return row ? this.toEntity(row) : null;
  }

  async findHomeroomInGroup(
    groupId: string,
    schoolYear: string,
    exceptId: string | null,
  ): Promise<TeacherAssignment | null> {
    const row = await this.prisma.db.teacherAssignment.findFirst({
      where: {
        groupId,
        schoolYear,
        isHomeroomTeacher: true,
        status: TeacherAssignmentStatus.Active,
        ...(exceptId && { id: { not: exceptId } }),
      },
      include: INCLUDE,
    });
    return row ? this.toEntity(row) : null;
  }

  async lockGroup(groupId: string): Promise<void> {
    await this.prisma.db.$queryRaw`SELECT id FROM grupo WHERE id = ${groupId}::uuid FOR UPDATE`;
  }

  async markOldestActiveAsHomeroom(
    teacherId: string,
    groupId: string,
    schoolYear: string,
  ): Promise<boolean> {
    const oldest = await this.prisma.db.teacherAssignment.findFirst({
      where: { teacherId, groupId, schoolYear, status: TeacherAssignmentStatus.Active },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    if (!oldest) {
      return false;
    }
    await this.prisma.db.teacherAssignment.update({
      where: { id: oldest.id },
      data: { isHomeroomTeacher: true },
    });
    return true;
  }

  async findActiveByTeacher(teacherId: string, schoolYear: string): Promise<TeacherAssignment[]> {
    const rows = await this.prisma.db.teacherAssignment.findMany({
      where: { teacherId, schoolYear, status: TeacherAssignmentStatus.Active },
      include: INCLUDE,
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findActiveByYear(schoolYear: string): Promise<TeacherAssignment[]> {
    const rows = await this.prisma.db.teacherAssignment.findMany({
      where: { schoolYear, status: TeacherAssignmentStatus.Active },
      include: INCLUDE,
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findActiveTeachers(areaId: string | null, schoolYear: string): Promise<TeacherInScope[]> {
    const where: Prisma.UserWhereInput =
      areaId === null
        ? { role: UserRole.Teacher, status: UserStatus.Active }
        : {
            status: UserStatus.Active,
            teacherAssignments: {
              some: { areaId, schoolYear, status: TeacherAssignmentStatus.Active },
            },
          };
    return this.prisma.db.user.findMany({
      where,
      select: { id: true, fullName: true },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
  }

  async create(input: NewTeacherAssignment): Promise<TeacherAssignment> {
    try {
      const row = await this.prisma.db.teacherAssignment.create({ data: input, include: INCLUDE });
      return this.toEntity(row);
    } catch (error) {
      throw this.translateHomeroomViolation(error, input.isHomeroomTeacher);
    }
  }

  async update(id: string, changes: TeacherAssignmentChanges): Promise<TeacherAssignment> {
    try {
      const row = await this.prisma.db.teacherAssignment.update({
        where: { id },
        data: changes,
        include: INCLUDE,
      });
      return this.toEntity(row);
    } catch (error) {
      throw this.translateHomeroomViolation(error, changes.isHomeroomTeacher === true);
    }
  }

  /**
   * Si dos altas simultáneas llegan al índice único parcial de director de grupo, la violación
   * se traduce al mismo 409 que la comprobación del servicio.
   */
  private translateHomeroomViolation(error: unknown, marksHomeroom: boolean): unknown {
    return marksHomeroom && isUniqueViolation(error)
      ? new ConflictException(HOMEROOM_RACE_MESSAGE)
      : error;
  }

  // `ModelDelegate` no admite `include`: se envuelve el delegado para fijarlo en las lecturas.
  protected get delegate(): ModelDelegate<AssignmentRow, Prisma.TeacherAssignmentWhereInput> {
    const model = this.prisma.db.teacherAssignment;
    return {
      findMany: (args) => model.findMany({ ...args, include: INCLUDE }),
      count: (args) => model.count(args),
      findUnique: (args) => model.findUnique({ ...args, include: INCLUDE }),
    };
  }

  protected toWhere(filters: TeacherAssignmentFilters): Prisma.TeacherAssignmentWhereInput {
    return {
      schoolYear: filters.schoolYear,
      teacherId: filters.teacherId,
      group: filters.gradeId ? { gradeId: filters.gradeId } : undefined,
      groupId: filters.groupId,
      areaId: filters.areaId,
      status: filters.status,
    };
  }

  protected toEntity(row: AssignmentRow): TeacherAssignment {
    return {
      id: row.id,
      schoolYear: row.schoolYear,
      status: row.status as TeacherAssignmentStatus,
      isHomeroomTeacher: row.isHomeroomTeacher,
      teacher: {
        id: row.teacher.id,
        fullName: row.teacher.fullName,
        status: row.teacher.status as UserStatus,
      },
      group: { id: row.group.id, name: row.group.name },
      grade: {
        id: row.group.grade.id,
        name: row.group.grade.name,
        sortOrder: row.group.grade.sortOrder,
      },
      level: { id: row.group.grade.level.id, name: row.group.grade.level.name },
      area: { id: row.area.id, name: row.area.name, type: row.area.type as AreaType },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
