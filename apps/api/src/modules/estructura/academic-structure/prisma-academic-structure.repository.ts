import { Injectable } from '@nestjs/common';
import {
  TeacherAssignmentStatus,
  UserRole,
  UserStatus,
  type AcademicStructure,
  type AreaType,
} from '@gns/shared';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { AcademicStructureRepository, CatalogUsage } from './academic-structure.repository';

const PERSON = { select: { id: true, fullName: true } } as const;

/** Orden natural de los nombres de grupo: «Kinder 2» antes de «Kinder 10». */
const byGroupName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'es', { numeric: true });

@Injectable()
export class PrismaAcademicStructureRepository implements AcademicStructureRepository {
  constructor(private readonly prisma: PrismaService) {}

  async read(schoolYear: string | null, usage: CatalogUsage): Promise<AcademicStructure> {
    const db = this.prisma.db;
    const [levels, areas, coordinators] = await Promise.all([
      db.educationLevel.findMany({
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: {
          grades: {
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            include: {
              coordinator: PERSON,
              groups: {
                include: {
                  // Una sola fila activa marcada por grupo y año (índice parcial).
                  teacherAssignments: {
                    where: {
                      schoolYear: schoolYear ?? '',
                      isHomeroomTeacher: true,
                      status: TeacherAssignmentStatus.Active,
                    },
                    select: { teacher: PERSON },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      }),
      db.area.findMany({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: { areaLevels: { select: { levelId: true } } },
      }),
      db.user.findMany({
        where: { role: UserRole.Coordinator, status: UserStatus.Active },
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        select: { id: true, fullName: true, coordinatedGrades: { select: { id: true } } },
      }),
    ]);

    return {
      schoolYear,
      levels: levels.map((level) => ({
        id: level.id,
        name: level.name,
        sortOrder: level.sortOrder,
        grades: level.grades.map((grade) => ({
          id: grade.id,
          name: grade.name,
          sortOrder: grade.sortOrder,
          active: grade.active,
          coordinator: grade.coordinator,
          inUse: (usage.grades.get(grade.id) ?? 0) > 0,
          groups: grade.groups.sort(byGroupName).map((group) => ({
            id: group.id,
            name: group.name,
            active: group.active,
            inUse: (usage.groups.get(group.id) ?? 0) > 0,
            homeroomTeacher: schoolYear ? (group.teacherAssignments[0]?.teacher ?? null) : null,
          })),
        })),
      })),
      areas: areas.map((area) => ({
        id: area.id,
        name: area.name,
        type: area.type as AreaType,
        active: area.active,
        levelIds: area.areaLevels.map((link) => link.levelId).sort(),
        usageCount: usage.areas.get(area.id) ?? 0,
      })),
      coordinators: coordinators.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        gradeIds: user.coordinatedGrades.map((grade) => grade.id),
      })),
    };
  }
}
