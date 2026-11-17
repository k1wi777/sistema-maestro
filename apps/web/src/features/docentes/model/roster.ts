import {
  TeacherAssignmentStatus,
  type AreaType,
  type TeacherAssignment,
  type User,
  type UserRole,
  type UserStatus,
} from '@gns/shared';

export interface RosterArea {
  assignmentId: string;
  areaId: string;
  name: string;
  type: AreaType;
}

export interface RosterGroup {
  id: string;
  name: string;
  gradeName: string;
  /** Orden del grado, para ordenar los grupos. */
  sortOrder: number;
  /** Alguna asignación activa del grupo marca la dirección de grupo. */
  isHomeroom: boolean;
  areas: RosterArea[];
}

export interface RosterTeacher {
  id: string;
  name: string;
  status: UserStatus;
  /** Solo se conoce cuando administración aporta la lista de usuarios. */
  role: UserRole | null;
  /** Grupos con asignaciones activas. */
  groups: RosterGroup[];
  /** Todas las asignaciones del año (activas y retiradas): el diálogo las necesita para reactivar. */
  assignments: TeacherAssignment[];
  withdrawnCount: number;
  /** Sin ninguna asignación en el año (solo aparece en la lista de administración). */
  unassigned: boolean;
}

export type RosterPerson = Pick<User, 'id' | 'fullName' | 'role' | 'status'>;

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es');

/** Minúsculas y sin tildes, para buscar por nombre. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Orden natural: «Kinder 2» antes de «Kinder 10». */
const byGroupName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'es', { numeric: true });

function groupsOf(assignments: TeacherAssignment[]): RosterGroup[] {
  const groups = new Map<string, RosterGroup>();
  for (const assignment of assignments) {
    if (assignment.status !== TeacherAssignmentStatus.Active) {
      continue;
    }
    const group = groups.get(assignment.group.id) ?? {
      id: assignment.group.id,
      name: assignment.group.name,
      gradeName: assignment.grade.name,
      sortOrder: assignment.grade.sortOrder,
      isHomeroom: false,
      areas: [],
    };
    group.isHomeroom ||= assignment.isHomeroomTeacher;
    group.areas.push({
      assignmentId: assignment.id,
      areaId: assignment.area.id,
      name: assignment.area.name,
      type: assignment.area.type,
    });
    groups.set(group.id, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, areas: group.areas.sort(byName) }))
    .sort((a, b) => a.sortOrder - b.sortOrder || byGroupName(a, b));
}

/**
 * Docentes del año con sus asignaciones agrupadas por grupo. Un docente con todas las asignaciones
 * retiradas sigue en la lista (tiene filas del año). `people` (solo llega en administración) aporta
 * el rol y suma como «sin asignar» a quienes no tienen ninguna asignación.
 */
export function buildRoster(
  assignments: TeacherAssignment[],
  people: RosterPerson[] = [],
): RosterTeacher[] {
  const byTeacher = new Map<string, TeacherAssignment[]>();
  for (const assignment of assignments) {
    byTeacher.set(assignment.teacher.id, [
      ...(byTeacher.get(assignment.teacher.id) ?? []),
      assignment,
    ]);
  }
  const known = new Map(people.map((person) => [person.id, person]));
  const roster: RosterTeacher[] = [...byTeacher].map(([id, own]) => {
    const person = known.get(id);
    const first = own[0]!;
    return {
      id,
      name: person?.fullName ?? first.teacher.fullName,
      status: person?.status ?? first.teacher.status,
      role: person?.role ?? null,
      groups: groupsOf(own),
      assignments: own,
      withdrawnCount: own.filter((item) => item.status === TeacherAssignmentStatus.Withdrawn)
        .length,
      unassigned: false,
    };
  });
  for (const person of people) {
    if (!byTeacher.has(person.id)) {
      roster.push({
        id: person.id,
        name: person.fullName,
        status: person.status,
        role: person.role,
        groups: [],
        assignments: [],
        withdrawnCount: 0,
        unassigned: true,
      });
    }
  }
  return roster.sort(byName);
}

/** Filtra por nombre sin importar tildes ni mayúsculas. */
export function filterRoster(roster: RosterTeacher[], search: string): RosterTeacher[] {
  const needle = normalizeText(search);
  return needle === ''
    ? roster
    : roster.filter((item) => normalizeText(item.name).includes(needle));
}
