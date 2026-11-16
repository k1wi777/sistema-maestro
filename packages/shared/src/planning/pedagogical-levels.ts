import { ACADEMIC_PERIODS_PER_YEAR } from '../structure/catalogs';

interface PedagogicalLevel {
  /** Proyecto transversal por número de periodo (índice 0 = periodo 1); `null` = sin proyecto. */
  projects: readonly (string | null)[];
  /** Solo bachillerato trabaja con las etapas CurioCity. */
  curiocity: boolean;
  /** Nombres de las dimensiones y asignaturas que se trabajan en el nivel (prototipo GNS). */
  areaNames: readonly string[];
}

const DIMENSIONS = [
  'Dimensión cognitiva',
  'Dimensión comunicativa',
  'Dimensión corporal y motora',
  'Dimensión estética',
  'Dimensión socioafectiva',
  'Dimensión espiritual',
  'Dimensión ética',
  'English (CLIL)',
  'Pre-ciencias',
] as const;

const BASE_SUBJECTS = [
  'Lengua Castellana',
  'Ciencias Naturales',
  'Ciencias Sociales',
  'Math',
  'Science',
  'English',
  'Art',
  'Música',
  'Deportes',
  'Social Studies',
] as const;

const PRESCHOOL_AREAS = [...DIMENSIONS, ...BASE_SUBJECTS.filter((name) => name !== 'English')];
const PRIMARY_AREAS = [
  ...BASE_SUBJECTS,
  'Matemáticas',
  'Tecnología e Informática',
  'Educación Artística',
  'Educación Física',
  'Ética y Valores',
  'Educación Religiosa',
];
const SECONDARY_AREAS = [
  ...PRIMARY_AREAS,
  'Física',
  'Química',
  'Filosofía',
  'Ciencias Económicas y Políticas',
  'Emprendimiento',
];

const NO_PROJECTS = Array<null>(ACADEMIC_PERIODS_PER_YEAR).fill(null);

/**
 * Regla pedagógica por nombre de nivel (CONTEXTO §2). El nombre de P3 de bachillerato es
 * el del prototipo. Un nivel con otro nombre (administración puede renombrarlos) no tiene
 * proyecto ni CurioCity: falla de forma segura en lugar de inventar un valor.
 */
const LEVELS: Record<string, PedagogicalLevel> = {
  'Preescolar bajo': { projects: NO_PROJECTS, curiocity: false, areaNames: PRESCHOOL_AREAS },
  'Preescolar alto (KTF)': {
    projects: ['Ciudad+', 'STEAM+H', 'Emprendimiento Inicial'],
    curiocity: false,
    areaNames: PRESCHOOL_AREAS,
  },
  Primaria: {
    projects: ['Ciudad+', 'STEAM+H', 'Emprendimiento Escolar'],
    curiocity: false,
    areaNames: PRIMARY_AREAS,
  },
  Bachillerato: {
    projects: ['STEAM+H', 'Ciudad+', 'Emprendimiento · Dragon Fire'],
    curiocity: true,
    areaNames: SECONDARY_AREAS,
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

/**
 * Nombres de las áreas (dimensiones y asignaturas) del nivel. Vacío si el nivel no se
 * reconoce: falla de forma segura, igual que el proyecto transversal y CurioCity.
 */
export function areaNamesForLevel(levelName: string): readonly string[] {
  return levelOf(levelName)?.areaNames ?? [];
}
