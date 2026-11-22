import { UserRole } from '@gns/shared';

/** Coordinadora de un grado, tal como la informa el catálogo de grados. */
export interface GradeCoordinator {
  id: string;
  fullName: string;
}

export interface ReviewUser {
  id: string;
  role: UserRole;
}

/** Grado del catálogo con su coordinadora (o `null`): lo único que la regla necesita. */
export interface CatalogGradeScope {
  id: string;
  name: string;
  active?: boolean;
  coordinator: GradeCoordinator | null;
}

/**
 * Solo la coordinadora del grado revisa (aprueba, devuelve, observa, anula como revisora). Es la
 * misma regla que aplica la API; aquí solo decide qué se pinta. Un grado sin coordinadora no lo
 * revisa nadie, ni siquiera administración.
 */
export function canReviewGrade(
  user: ReviewUser | null,
  coordinator: GradeCoordinator | null,
): boolean {
  return user?.role === UserRole.Coordinator && coordinator !== null && coordinator.id === user.id;
}

/** Coordinadora de un grado del catálogo; `null` si no tiene o el grado no está en el catálogo. */
export function coordinatorOfGrade(
  grades: readonly CatalogGradeScope[],
  gradeId: string,
): GradeCoordinator | null {
  return grades.find((grade) => grade.id === gradeId)?.coordinator ?? null;
}

/** Grados que coordina la persona de la sesión. */
export function myGrades<T extends CatalogGradeScope>(
  user: ReviewUser | null,
  grades: readonly T[],
): T[] {
  if (user?.role !== UserRole.Coordinator) {
    return [];
  }
  return grades.filter((grade) => grade.coordinator?.id === user.id);
}

/** Grados activos que nadie coordina: sus registros enviados no tienen quién los revise. */
export function gradesWithoutCoordinator<T extends CatalogGradeScope>(grades: readonly T[]): T[] {
  return grades.filter((grade) => grade.active !== false && grade.coordinator === null);
}

/** «Revisa: Elena Ravassa» o «Sin coordinadora». */
export function reviewerHint(coordinator: GradeCoordinator | null): string {
  return coordinator ? `Revisa: ${coordinator.fullName}` : 'Sin coordinadora';
}

/** Lista de nombres en español: «Kinder y Transition», «Red, Blue y Green». */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1) ?? ''}`;
}

/**
 * Texto del aviso «Solo consulta» al abrir un registro que la persona no revisa. `noun` lleva el
 * artículo («esta planeación», «este diario», «esta anotación»).
 */
export function consultNotice(
  user: ReviewUser | null,
  coordinator: GradeCoordinator | null,
  gradeName: string,
  noun: string,
): string {
  if (user?.role === UserRole.Administrator) {
    return coordinator
      ? `Administración consulta los registros; la revisión es de ${coordinator.fullName}, coordinadora de ${gradeName}.`
      : `Administración consulta los registros. ${gradeName} no tiene coordinadora: nadie revisa ${noun}. Asígnale una en Grados y áreas.`;
  }
  return coordinator
    ? `${gradeName} lo acompaña ${coordinator.fullName}: puedes leer ${noun}, pero la revisión es suya.`
    : `${gradeName} no tiene coordinadora: puedes leer ${noun}, pero por ahora nadie la revisa.`;
}
