import { Injectable } from '@nestjs/common';
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
  grade: { include: { level: { select: { id: true, name: true } } } },
  area: { select: { id: true, name: true, type: true } },
} satisfies Prisma.TeacherAssignmentInclude;

type AssignmentRow = Prisma.TeacherAssignmentGetPayload<{ include: typeof INCLUDE }>;

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
    gradeId: string,
    areaId: string,
    schoolYear: string,
  ): Promise<TeacherAssignment | null> {
    const row = await this.prisma.db.teacherAssignment.findUnique({
      where: { teacherId_gradeId_areaId_schoolYear: { teacherId, gradeId, areaId, schoolYear } },
      include: INCLUDE,
    });
    return row ? this.toEntity(row) : null;
  }

  async findHomeroomOfAnotherTeacher(
    gradeId: string,
    schoolYear: string,
    teacherId: string,
  ): Promise<TeacherAssignment | null> {
    const row = await this.prisma.db.teacherAssignment.findFirst({
      where: {
        gradeId,
        schoolYear,
        isHomeroomTeacher: true,
        status: TeacherAssignmentStatus.Active,
        teacherId: { not: teacherId },
      },
      include: INCLUDE,
    });
    return row ? this.toEntity(row) : null;
  }

  async lockGrade(gradeId: string): Promise<void> {
    await this.prisma.db.$queryRaw`SELECT id FROM grado WHERE id = ${gradeId}::uuid FOR UPDATE`;
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
    const row = await this.prisma.db.teacherAssignment.create({ data: input, include: INCLUDE });
    return this.toEntity(row);
  }

  async update(id: string, changes: TeacherAssignmentChanges): Promise<TeacherAssignment> {
    const row = await this.prisma.db.teacherAssignment.update({
      where: { id },
      data: changes,
      include: INCLUDE,
    });
    return this.toEntity(row);
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
      gradeId: filters.gradeId,
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
      grade: { id: row.grade.id, name: row.grade.name, sortOrder: row.grade.sortOrder },
      level: { id: row.grade.level.id, name: row.grade.level.name },
      area: { id: row.area.id, name: row.area.name, type: row.area.type as AreaType },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
