import { TeacherAssignmentStatus, type TeacherAssignment } from '@gns/shared';

export type AssignmentStep =
  | { kind: 'create'; areaId: string; areaName: string }
  | { kind: 'reactivate'; assignmentId: string; areaId: string; areaName: string }
  | { kind: 'skip'; areaId: string; areaName: string };

export interface AreaChoice {
  id: string;
  name: string;
}

/**
 * Qué enviar a la API al asignar áreas a un grado: si el docente ya tiene la asignación activa se
 * omite; si la tiene retirada se reactiva (crear daría 409 con el id solo en el mensaje) y si no
 * existe se crea. `existing` son las asignaciones del docente en el año vigente.
 */
export function planAssignments(
  existing: TeacherAssignment[],
  gradeId: string,
  areas: AreaChoice[],
): AssignmentStep[] {
  return areas.map((area): AssignmentStep => {
    const matches = existing.filter(
      (assignment) => assignment.grade.id === gradeId && assignment.area.id === area.id,
    );
    if (matches.some((assignment) => assignment.status === TeacherAssignmentStatus.Active)) {
      return { kind: 'skip', areaId: area.id, areaName: area.name };
    }
    const withdrawn = matches[0];
    return withdrawn
      ? { kind: 'reactivate', assignmentId: withdrawn.id, areaId: area.id, areaName: area.name }
      : { kind: 'create', areaId: area.id, areaName: area.name };
  });
}

/**
 * Asignaciones a modificar para marcar o desmarcar la dirección de grupo de un docente en un
 * grado (la API la guarda por asignación): marcar usa la primera asignación activa del grado y no
 * hace nada si ya hay una marcada; desmarcar quita la marca de todas las activas que la tengan.
 */
export function homeroomTargets(
  assignments: TeacherAssignment[],
  gradeId: string,
  on: boolean,
): string[] {
  const active = assignments.filter(
    (assignment) =>
      assignment.grade.id === gradeId && assignment.status === TeacherAssignmentStatus.Active,
  );
  if (on) {
    return active.some((assignment) => assignment.isHomeroomTeacher) || active.length === 0
      ? []
      : [active[0]!.id];
  }
  return active.filter((assignment) => assignment.isHomeroomTeacher).map((item) => item.id);
}
