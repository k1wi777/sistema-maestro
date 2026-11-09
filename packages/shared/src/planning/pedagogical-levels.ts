import { ACADEMIC_PERIODS_PER_YEAR } from '../structure/catalogs';

interface PedagogicalLevel {
  /** Proyecto transversal por número de periodo (índice 0 = periodo 1); `null` = sin proyecto. */
  projects: readonly (string | null)[];
  /** Solo bachillerato trabaja con las etapas CurioCity. */
  curiocity: boolean;
}

const NO_PROJECTS = Array<null>(ACADEMIC_PERIODS_PER_YEAR).fill(null);

/**
 * Regla pedagógica por nombre de nivel (CONTEXTO §2). El nombre de P3 de bachillerato es
 * el del prototipo. Un nivel con otro nombre (administración puede renombrarlos) no tiene
 * proyecto ni CurioCity: falla de forma segura en lugar de inventar un valor.
 */
const LEVELS: Record<string, PedagogicalLevel> = {
  'Preescolar bajo': { projects: NO_PROJECTS, curiocity: false },
  'Preescolar alto (KTF)': {
    projects: ['Ciudad+', 'STEAM+H', 'Emprendimiento Inicial'],
    curiocity: false,
  },
  Primaria: { projects: ['Ciudad+', 'STEAM+H', 'Emprendimiento Escolar'], curiocity: false },
  Bachillerato: {
    projects: ['STEAM+H', 'Ciudad+', 'Emprendimiento · Dragon Fire'],
    curiocity: true,
  },
};

const levelOf = (levelName: string): PedagogicalLevel | undefined =>
  Object.hasOwn(LEVELS, levelName) ? LEVELS[levelName] : undefined;

/** Proyecto transversal de un nivel en un periodo, o `null` si el nivel no tiene proyectos. */
export function crossCuttingProjectFor(levelName: string, periodNumber: number): string | null {
  return levelOf(levelName)?.projects[periodNumber - 1] ?? null;
}

/** Indica si el nivel admite etapa CurioCity. */
export function levelAllowsCuriocity(levelName: string): boolean {
  return levelOf(levelName)?.curiocity ?? false;
}
