/**
 * Único punto que decide si un grado, grupo o área está «en uso»: cuenta las filas que lo
 * referencian, de cualquier estado (anuladas y retiradas también son registro). Las tablas
 * nuevas que referencien el catálogo se añaden aquí.
 */
export interface CatalogUsageRepository {
  /** Asignaciones docentes del grupo. */
  countGroup(groupId: string): Promise<number>;
  /** Asignaciones de sus grupos, planeaciones, diarios, anotaciones del observador y actividades. */
  countGrade(gradeId: string): Promise<number>;
  /** Asignaciones, planeaciones, actividades del repositorio y planes de formación del área. */
  countArea(areaId: string): Promise<number>;
  /** Usos por id (solo los que tienen alguno). */
  groupUsage(): Promise<Map<string, number>>;
  gradeUsage(): Promise<Map<string, number>>;
  areaUsage(): Promise<Map<string, number>>;
}

export const CATALOG_USAGE_REPOSITORY = Symbol('CATALOG_USAGE_REPOSITORY');
