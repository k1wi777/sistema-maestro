import { Injectable } from '@nestjs/common';
import {
  areaNamesForLevel,
  MAX_PAGE_SIZE,
  type Area,
  type LessonPlanOptions,
  type MyAssignments,
} from '@gns/shared';
import { AreasService } from '../../estructura/catalogs/area/areas.service';
import { TeacherAssignmentsService } from '../../estructura/assignments/teacher-assignments.service';

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es');

/**
 * Calcula con qué grados y áreas puede crear una planeación un docente (P1 y P2 del Work
 * Item): solo los grados con asignación activa del año vigente y, en cada uno, las áreas
 * del nivel (regla pedagógica de `@gns/shared`) más las que el docente tiene asignadas. La
 * validación del servicio y las casillas de la web salen de esta misma función.
 */
@Injectable()
export class LessonPlanOptionsService {
  constructor(
    private readonly assignments: TeacherAssignmentsService,
    private readonly areas: AreasService,
  ) {}

  async forTeacher(teacherId: string): Promise<LessonPlanOptions> {
    const mine = await this.assignments.listMine(teacherId);
    return this.build(mine, await this.catalog());
  }

  /** Todo el catálogo de áreas (30 en producción), página por página. */
  private async catalog(): Promise<Area[]> {
    const items: Area[] = [];
    for (let page = 1; ; page += 1) {
      const result = await this.areas.list({
        page,
        pageSize: MAX_PAGE_SIZE,
        sort: { field: 'name', order: 'asc' },
        filters: {},
      });
      items.push(...result.items);
      if (page >= result.totalPages) {
        return items;
      }
    }
  }

  private build(mine: MyAssignments, catalog: Area[]): LessonPlanOptions {
    return {
      schoolYear: mine.schoolYear,
      grades: mine.grades.map((entry) => {
        const assigned = new Set(entry.areas.map((area) => area.id));
        const levelNames = new Set(areaNamesForLevel(entry.level.name));
        const areas = catalog
          .filter((area) => levelNames.has(area.name) || assigned.has(area.id))
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
