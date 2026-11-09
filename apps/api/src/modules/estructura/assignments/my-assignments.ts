import type { MyAssignments, TeacherAssignment } from '@gns/shared';

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es');

/**
 * Agrupa por grado las asignaciones del docente: el cliente elige primero el grado y luego el
 * área. Un grado dirige el grupo si alguna de sus filas lo marca. Grados por `sortOrder` y
 * áreas por nombre.
 */
export function groupAssignmentsByGrade(
  schoolYear: string,
  assignments: TeacherAssignment[],
): MyAssignments {
  const grades = new Map<string, MyAssignments['grades'][number]>();
  for (const assignment of assignments) {
    let entry = grades.get(assignment.grade.id);
    if (!entry) {
      entry = {
        grade: assignment.grade,
        level: assignment.level,
        isHomeroomTeacher: false,
        areas: [],
      };
      grades.set(assignment.grade.id, entry);
    }
    entry.isHomeroomTeacher ||= assignment.isHomeroomTeacher;
    entry.areas.push({
      assignmentId: assignment.id,
      id: assignment.area.id,
      name: assignment.area.name,
      type: assignment.area.type,
    });
  }
  const sorted = [...grades.values()].sort(
    (a, b) => a.grade.sortOrder - b.grade.sortOrder || byName(a.grade, b.grade),
  );
  for (const entry of sorted) {
    entry.areas.sort(byName);
  }
  return { schoolYear, grades: sorted };
}
