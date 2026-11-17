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
 * Qué enviar a la API al asignar áreas a un grupo: si el docente ya tiene la asignación activa se
 * omite; si la tiene retirada se reactiva (crear daría 409 con el id solo en el mensaje) y si no
 * existe se crea. `existing` son las asignaciones del docente en el año vigente.
 */
export function planAssignments(
  existing: TeacherAssignment[],
  groupId: string,
  areas: AreaChoice[],
): AssignmentStep[] {
  return areas.map((area): AssignmentStep => {
    const matches = existing.filter(
      (assignment) => assignment.group.id === groupId && assignment.area.id === area.id,
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
 * grupo (la API la guarda por asignación): marcar usa la primera asignación activa del grupo y no
 * hace nada si ya hay una marcada; desmarcar quita la marca de todas las activas que la tengan.
 */
export function homeroomTargets(
  assignments: TeacherAssignment[],
  groupId: string,
  on: boolean,
): string[] {
  const active = assignments.filter(
    (assignment) =>
      assignment.group.id === groupId && assignment.status === TeacherAssignmentStatus.Active,
  );
  if (on) {
    return active.some((assignment) => assignment.isHomeroomTeacher) || active.length === 0
      ? []
      : [active[0]!.id];
  }
  return active.filter((assignment) => assignment.isHomeroomTeacher).map((item) => item.id);
}

/**
 * Dónde queda la marca «Director(a) de este grupo» al asignar: en el alta de la primera área nueva;
 * si no hay altas, en la primera reactivación (tras reactivarla) y, si tampoco, en la primera
 * asignación activa ya existente del grupo. Nulos si no hay dónde ponerla.
 */
export function planHomeroom(
  steps: AssignmentStep[],
  existing: TeacherAssignment[],
  groupId: string,
): { onCreateAreaId: string | null; afterAssignmentId: string | null } {
  const create = steps.find((step) => step.kind === 'create');
  if (create) {
    return { onCreateAreaId: create.areaId, afterAssignmentId: null };
  }
  const reactivate = steps.find((step) => step.kind === 'reactivate');
  if (reactivate && reactivate.kind === 'reactivate') {
    return { onCreateAreaId: null, afterAssignmentId: reactivate.assignmentId };
  }
  const [target] = homeroomTargets(existing, groupId, true);
  return { onCreateAreaId: null, afterAssignmentId: target ?? null };
}
