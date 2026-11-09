import {
  ComplianceStatus,
  type AcademicPeriod,
  type ComplianceItem,
  type ComplianceTeacher,
  type TeacherAssignment,
} from '@gns/shared';
import type { DeliveredCount } from '../lesson-plans/lesson-plan.repository';

const keyOf = (teacherId: string, gradeId: string, areaId: string, periodId: string): string =>
  `${teacherId}|${gradeId}|${areaId}|${periodId}`;

const compare = (a: string, b: string): number => a.localeCompare(b, 'es');

/**
 * Matriz de cumplimiento: una celda por asignación activa y periodo. Las entregas de una
 * combinación sin asignación activa no generan celdas (asignación retirada o ajena). Docentes
 * por nombre; celdas por orden del grado, nombre del área y número de periodo.
 */
export function buildCompliance(
  periods: readonly AcademicPeriod[],
  assignments: readonly TeacherAssignment[],
  delivered: readonly DeliveredCount[],
): ComplianceTeacher[] {
  const counts = new Map(
    delivered.map((entry) => [
      keyOf(entry.teacherId, entry.gradeId, entry.areaId, entry.periodId),
      entry.count,
    ]),
  );

  const byTeacher = new Map<
    string,
    { teacher: TeacherAssignment['teacher']; assignments: TeacherAssignment[] }
  >();
  for (const assignment of assignments) {
    const entry = byTeacher.get(assignment.teacher.id) ?? {
      teacher: assignment.teacher,
      assignments: [],
    };
    entry.assignments.push(assignment);
    byTeacher.set(assignment.teacher.id, entry);
  }

  const teachers = [...byTeacher.values()].map(
    ({ teacher, assignments: own }): ComplianceTeacher => {
      const ordered = [...own].sort(
        (a, b) =>
          a.grade.sortOrder - b.grade.sortOrder ||
          compare(a.area.name, b.area.name) ||
          compare(a.id, b.id),
      );
      const items = ordered.flatMap((assignment) =>
        periods.map((period): ComplianceItem => {
          const deliveredCount =
            counts.get(
              keyOf(assignment.teacher.id, assignment.grade.id, assignment.area.id, period.id),
            ) ?? 0;
          return {
            grade: { id: assignment.grade.id, name: assignment.grade.name },
            level: { id: assignment.level.id, name: assignment.level.name },
            area: { id: assignment.area.id, name: assignment.area.name },
            period: { id: period.id, number: period.number },
            status: deliveredCount > 0 ? ComplianceStatus.Delivered : ComplianceStatus.Pending,
            deliveredCount,
          };
        }),
      );
      const done = items.filter((item) => item.status === ComplianceStatus.Delivered).length;
      return {
        teacher: { id: teacher.id, fullName: teacher.fullName },
        deliveredCount: done,
        pendingCount: items.length - done,
        items,
      };
    },
  );

  return teachers.sort(
    (a, b) =>
      compare(a.teacher.fullName, b.teacher.fullName) || compare(a.teacher.id, b.teacher.id),
  );
}
