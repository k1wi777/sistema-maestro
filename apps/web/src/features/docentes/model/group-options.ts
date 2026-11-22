export interface GroupSource {
  id: string;
  name: string;
  gradeId: string;
}
export interface GradeSource {
  id: string;
  name: string;
  levelId: string;
  sortOrder: number;
  active: boolean;
}
export interface LevelSource {
  id: string;
  name: string;
}
export interface AreaSource {
  id: string;
  name: string;
  type: 'dimension' | 'asignatura';
  active: boolean;
  levelIds: string[];
}

/** Grupo ofrecido al asignar, con el nivel que define sus áreas. */
export interface GroupOption {
  id: string;
  /** «Kinder 1 · Preescolar alto (KTF)». */
  label: string;
  levelId: string;
}

const byNatural = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });

/** Grupos de grados activos, por orden del grado y número del grupo (el llamador ya filtra los activos). */
export function groupOptions(
  groups: GroupSource[],
  grades: GradeSource[],
  levels: LevelSource[],
): GroupOption[] {
  const gradeById = new Map(grades.map((grade) => [grade.id, grade]));
  const levelName = new Map(levels.map((level) => [level.id, level.name]));
  return groups
    .flatMap((group) => {
      const grade = gradeById.get(group.gradeId);
      return grade?.active ? [{ group, grade }] : [];
    })
    .sort((a, b) => a.grade.sortOrder - b.grade.sortOrder || byNatural(a.group.name, b.group.name))
    .map(({ group, grade }) => ({
      id: group.id,
      label: `${group.name} · ${levelName.get(grade.levelId) ?? ''}`.replace(/ · $/, ''),
      levelId: grade.levelId,
    }));
}

/**
 * Ids de los grupos en los que se puede asignar: con `allowedGradeIds` (coordinadora: solo sus
 * grados) los de esos grados; sin él (administración), todos.
 */
export function editableGroupIds(
  groups: readonly GroupSource[],
  allowedGradeIds: ReadonlySet<string> | null,
): Set<string> {
  return new Set(
    groups
      .filter((group) => allowedGradeIds === null || allowedGradeIds.has(group.gradeId))
      .map((group) => group.id),
  );
}

/** Áreas activas del nivel del grupo. */
export function areasForLevel<T extends AreaSource>(areas: T[], levelId: string): T[] {
  return areas.filter((area) => area.active && area.levelIds.includes(levelId));
}
