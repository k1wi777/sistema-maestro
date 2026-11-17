import type { AcademicStructure } from '@gns/shared';

/** Usos por id de cada tipo de elemento (ausente = sin uso). */
export interface CatalogUsage {
  groups: ReadonlyMap<string, number>;
  grades: ReadonlyMap<string, number>;
  areas: ReadonlyMap<string, number>;
}

export interface AcademicStructureRepository {
  /** Lectura completa de «Grados y áreas»; `schoolYear` nulo = sin año vigente (sin director). */
  read(schoolYear: string | null, usage: CatalogUsage): Promise<AcademicStructure>;
}

export const ACADEMIC_STRUCTURE_REPOSITORY = Symbol('ACADEMIC_STRUCTURE_REPOSITORY');
