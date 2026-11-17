import { Injectable } from '@nestjs/common';
import { MAX_PAGE_SIZE, type Area, type LessonPlanOptions, type MyAssignments } from '@gns/shared';
import { AreasService } from '../../estructura/catalogs/area/areas.service';
import { GradesService } from '../../estructura/catalogs/grade/grades.service';
import { TeacherAssignmentsService } from '../../estructura/assignments/teacher-assignments.service';

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es');

/**
 * Calcula con qué grados y áreas puede crear una planeación un docente (P1 y P2 del Work
 * Item): solo los grados activos con asignación activa del año vigente y, en cada uno, las
 * áreas activas del nivel (relación área–nivel de la base) más las activas que el docente tiene
 * asignadas. La validación del servicio y las casillas de la web salen de esta misma función.
 */
@Injectable()
export class LessonPlanOptionsService {
  constructor(
    private readonly assignments: TeacherAssignmentsService,
    private readonly areas: AreasService,
    private readonly grades: GradesService,
  ) {}

  async forTeacher(teacherId: string): Promise<LessonPlanOptions> {
    const mine = await this.assignments.listMine(teacherId);
    const [catalog, activeGrades] = await Promise.all([this.catalog(), this.activeGradeIds()]);
    return this.build(mine, catalog, activeGrades);
  }

  /** Ids de los grados activos (menos de 100 en el colegio). */
  private async activeGradeIds(): Promise<Set<string>> {
    const ids = new Set<string>();
    for (let page = 1; ; page += 1) {
      const result = await this.grades.list({
        page,
        pageSize: MAX_PAGE_SIZE,
        sort: { field: 'sortOrder', order: 'asc' },
        filters: { active: true },
      });
      result.items.forEach((grade) => ids.add(grade.id));
      if (page >= result.totalPages) {
        return ids;
      }
    }
  }

  /** Las áreas activas del catálogo (30 en producción), página por página. */
  private async catalog(): Promise<Area[]> {
    const items: Area[] = [];
    for (let page = 1; ; page += 1) {
      const result = await this.areas.list({
        page,
        pageSize: MAX_PAGE_SIZE,
        sort: { field: 'name', order: 'asc' },
        filters: { active: true },
      });
      items.push(...result.items);
      if (page >= result.totalPages) {
        return items;
      }
    }
  }

  private build(
    mine: MyAssignments,
    catalog: Area[],
    activeGrades: ReadonlySet<string>,
  ): LessonPlanOptions {
    return {
      schoolYear: mine.schoolYear,
      grades: mine.grades
        .filter((entry) => activeGrades.has(entry.grade.id))
        .map((entry) => {
          const assigned = new Set(entry.areas.map((area) => area.id));
          const areas = catalog
            .filter((area) => area.levelIds.includes(entry.level.id) || assigned.has(area.id))
            .map((area) => ({
              id: area.id,
              name: area.name,
              type: area.type,
              assigned: assigned.has(area.id),
            }))
            .sort(byName);
          return { grade: entry.grade, level: entry.level, areas };
        }),
    };
  }
}
