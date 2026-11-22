import { UserRole } from '@gns/shared';

export interface RoleChangeContext {
  /** Nombre de la persona. */
  name: string;
  from: UserRole;
  to: UserRole;
  /** Grupos con asignaciones activas del año vigente y, de ellos, los que dirige. */
  groups: { name: string; isHomeroom: boolean }[];
  /** Grados que hoy coordina. */
  coordinatedGrades: string[];
}

function list(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1) ?? ''}`;
}

/**
 * Consecuencias de cambiar el rol, con los datos ya cargados (el año vigente): lo que se avisa
 * antes de confirmar. La API aplica las consecuencias completas (todos los años); esto es
 * orientativo. Siempre termina con la conservación de los registros.
 */
export function roleChangeConsequences({
  name,
  from,
  to,
  groups,
  coordinatedGrades,
}: RoleChangeContext): string[] {
  const lines: string[] = [];
  if (from === UserRole.Teacher && to !== UserRole.Teacher) {
    const homeroom = groups.filter((group) => group.isHomeroom).map((group) => group.name);
    const assigned = groups.map((group) => group.name);
    lines.push(
      assigned.length === 0
        ? `${name} deja de ser docente: no tiene asignaciones activas en el año vigente.`
        : `${name} deja de ser docente: se retiran sus asignaciones en ${list(assigned)}${
            homeroom.length > 0
              ? ` y deja de ser director(a) de ${list(homeroom)}, que quedará sin director(a)`
              : ''
          }.`,
    );
  }
  if (from === UserRole.Coordinator && to !== UserRole.Coordinator) {
    lines.push(
      coordinatedGrades.length === 0
        ? `${name} deja de ser coordinadora: no tiene grados a su cargo.`
        : `${name} deja de ser coordinadora: ${list(coordinatedGrades)} ${
            coordinatedGrades.length === 1 ? 'quedará' : 'quedarán'
          } sin coordinadora y nadie revisará sus registros hasta que asignes a otra persona en Grados y áreas.`,
    );
  }
  if (to === UserRole.Coordinator) {
    lines.push('Asígnale grados en Grados y áreas para que pueda revisar.');
  }
  lines.push('Sus registros se conservan.');
  lines.push('Sus sesiones abiertas se cerrarán y deberá ingresar de nuevo.');
  return lines;
}

/** Aviso al desactivar a una coordinadora con grados: nadie los revisa mientras esté inactiva. */
export function deactivationWarning(grades: readonly string[]): string | null {
  if (grades.length === 0) {
    return null;
  }
  return `${list(grades)} no tendrán quién revise mientras esté inactiva.`;
}
