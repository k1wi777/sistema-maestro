/** «Mis grados» (por defecto, solo coordinación) o «Todo el colegio». */
export type InboxScope = 'mine' | 'all';

/** Valor del parámetro `vista` de la URL para «Todo el colegio». */
export const COLLEGE_VIEW = 'colegio';

/**
 * Alcance de una bandeja. Coordinación empieza en «Mis grados» y puede pasar a «Todo el colegio»;
 * sin grados asignados solo puede consultar todo el colegio; administración siempre ve todo.
 */
export function resolveScope(
  isCoordinator: boolean,
  hasGrades: boolean,
  vista: string | null,
): InboxScope {
  if (!isCoordinator || !hasGrades) {
    return 'all';
  }
  return vista === COLLEGE_VIEW ? 'all' : 'mine';
}

/** Valor del parámetro `vista` para un alcance (`null` quita el parámetro: «Mis grados»). */
export function vistaParam(scope: InboxScope): string | null {
  return scope === 'all' ? COLLEGE_VIEW : null;
}

/**
 * Filtro `coordinatorId` de la lista: en «Mis grados», el propio; en «Todo el colegio», el que
 * elija administración (UUID o `none`), si lo hay.
 */
export function coordinatorFilter(
  scope: InboxScope,
  isCoordinator: boolean,
  userId: string | undefined,
  chosen: string | undefined,
): string | undefined {
  if (isCoordinator) {
    return scope === 'mine' ? userId : undefined;
  }
  return chosen;
}

/** Mensaje de la coordinadora sin grados asignados (tablero Co-diarios, para cualquier formato). */
export function noGradesMessage(plural: string): string {
  return `Aún no tienes grados asignados: puedes consultar ${plural} de todo el colegio, pero no revisarlos. Pídele a administración que te los asigne en Grados y áreas.`;
}
