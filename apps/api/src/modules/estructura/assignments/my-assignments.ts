import type { MyAssignments, TeacherAssignment } from '@gns/shared';

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es');
/** Orden natural: «Kinder 2» antes de «Kinder 10». */
const byGroupName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'es', { numeric: true });

/**
 * Agrupa por grado las asignaciones del docente: el cliente elige primero el grado y luego el
 * área. Un grado dirige el grupo si alguno de sus grupos lo marca. El área que el docente tiene
 * en varios grupos del mismo grado aparece una sola vez. Grados por `sortOrder`, grupos por
 * número y áreas por nombre.
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
        groups: [],
        areas: [],
      };
      grades.set(assignment.grade.id, entry);
    }
    entry.isHomeroomTeacher ||= assignment.isHomeroomTeacher;

    const group = entry.groups.find((candidate) => candidate.id === assignment.group.id);
    if (group) {
      group.isHomeroomTeacher ||= assignment.isHomeroomTeacher;
    } else {
      entry.groups.push({
        id: assignment.group.id,
        name: assignment.group.name,
        isHomeroomTeacher: assignment.isHomeroomTeacher,
      });
    }
    if (!entry.areas.some((area) => area.id === assignment.area.id)) {
      entry.areas.push({
        id: assignment.area.id,
        name: assignment.area.name,
        type: assignment.area.type,
      });
    }
  }
  const sorted = [...grades.values()].sort(
    (a, b) => a.grade.sortOrder - b.grade.sortOrder || byName(a.grade, b.grade),
  );
  for (const entry of sorted) {
    entry.areas.sort(byName);
    entry.groups.sort(byGroupName);
  }
  return { schoolYear, grades: sorted };
}
