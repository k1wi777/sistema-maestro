import type { AcademicStructure, AreaType } from '@gns/shared';

type Level = AcademicStructure['levels'][number];
export type StructureGrade = Level['grades'][number];
export type StructureArea = AcademicStructure['areas'][number];
export type StructureCoordinator = AcademicStructure['coordinators'][number];

/** Orden natural de los nombres: «Kinder 2» antes de «Kinder 10». */
export function compareNatural(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true });
}

/**
 * Nombre propuesto para un grupo nuevo: `<grado> <n+1>`, donde n es el mayor número que ya usan
 * los grupos del grado con ese prefijo (o la cantidad de grupos si ninguno lo lleva). Nunca repite
 * un nombre existente.
 */
export function nextGroupName(grade: Pick<StructureGrade, 'name' | 'groups'>): string {
  const prefix = `${grade.name} `;
  const taken = new Set(grade.groups.map((group) => group.name));
  let highest = grade.groups.length;
  for (const group of grade.groups) {
    const match = group.name.startsWith(prefix)
      ? /^\d+$/.exec(group.name.slice(prefix.length))
      : null;
    if (match) {
      highest = Math.max(highest, Number(match[0]));
    }
  }
  let candidate = highest + 1;
  while (taken.has(`${prefix}${candidate}`)) {
    candidate += 1;
  }
  return `${prefix}${candidate}`;
}

/** Grados activos que ninguna coordinadora tiene a su cargo (la página avisa de cada uno). */
export function gradesWithoutCoordinator(structure: AcademicStructure): StructureGrade[] {
  return structure.levels.flatMap((level) =>
    level.grades.filter((grade) => grade.active && grade.coordinator === null),
  );
}

export interface AreaFilter {
  type: AreaType | '';
  levelId: string;
}

export function filterAreas(areas: StructureArea[], filter: AreaFilter): StructureArea[] {
  return areas.filter(
    (area) =>
      (filter.type === '' || area.type === filter.type) &&
      (filter.levelId === '' || area.levelIds.includes(filter.levelId)),
  );
}

/** Nombres de los niveles de un área, en el orden de los niveles. */
export function levelNamesOf(area: StructureArea, levels: Pick<Level, 'id' | 'name'>[]): string {
  return levels
    .filter((level) => area.levelIds.includes(level.id))
    .map((level) => level.name)
    .join(', ');
}

/** Grados (con su nivel) que una coordinadora tiene a su cargo, por orden del grado. */
export function gradesOfCoordinator(
  structure: AcademicStructure,
  coordinator: StructureCoordinator,
): StructureGrade[] {
  return structure.levels.flatMap((level) =>
    level.grades.filter((grade) => coordinator.gradeIds.includes(grade.id)),
  );
}

export type RemoveDecision = 'delete' | 'deactivate';

/** Un elemento sin uso se puede borrar; en uso solo se desactiva y lo registrado se conserva. */
export function removeDecision(inUse: boolean): RemoveDecision {
  return inUse ? 'deactivate' : 'delete';
}

/** Orden propuesto para un grado nuevo: después del último que existe. */
export function nextGradeOrder(structure: AcademicStructure): number {
  const orders = structure.levels.flatMap((level) => level.grades.map((grade) => grade.sortOrder));
  return Math.max(0, ...orders) + 1;
}

/** Orden válido de un grado: entero de 1 a 32767 (`orden` es SmallInt). */
export function parseGradeOrder(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) {
    return null;
  }
  const value = Number(text);
  return value >= 1 && value <= 32767 ? value : null;
}
