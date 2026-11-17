import { AreaType } from '@gns/shared';

// Generado a partir del prototipo (fuentes del Work Item); editar con cuidado.

export const SCHOOL_YEAR = '2026-2027';

export const LEVELS = [
  {
    name: 'Preescolar bajo',
    sortOrder: 1,
  },
  {
    name: 'Preescolar alto (KTF)',
    sortOrder: 2,
  },
  {
    name: 'Primaria',
    sortOrder: 3,
  },
  {
    name: 'Bachillerato',
    sortOrder: 4,
  },
] as const;

export const GRADES = [
  {
    name: 'Red',
    levelName: 'Preescolar bajo',
    sortOrder: 1,
  },
  {
    name: 'Blue',
    levelName: 'Preescolar bajo',
    sortOrder: 2,
  },
  {
    name: 'Purple',
    levelName: 'Preescolar bajo',
    sortOrder: 3,
  },
  {
    name: 'Green',
    levelName: 'Preescolar bajo',
    sortOrder: 4,
  },
  {
    name: 'Garden',
    levelName: 'Preescolar bajo',
    sortOrder: 5,
  },
  {
    name: 'Kinder',
    levelName: 'Preescolar alto (KTF)',
    sortOrder: 6,
  },
  {
    name: 'Transition',
    levelName: 'Preescolar alto (KTF)',
    sortOrder: 7,
  },
  {
    name: 'First Grade',
    levelName: 'Preescolar alto (KTF)',
    sortOrder: 8,
  },
  {
    name: '2°',
    levelName: 'Primaria',
    sortOrder: 9,
  },
  {
    name: '3°',
    levelName: 'Primaria',
    sortOrder: 10,
  },
  {
    name: '4°',
    levelName: 'Primaria',
    sortOrder: 11,
  },
  {
    name: '5°',
    levelName: 'Primaria',
    sortOrder: 12,
  },
  {
    name: '6°',
    levelName: 'Bachillerato',
    sortOrder: 13,
  },
  {
    name: '7°',
    levelName: 'Bachillerato',
    sortOrder: 14,
  },
  {
    name: '8°',
    levelName: 'Bachillerato',
    sortOrder: 15,
  },
  {
    name: '9°',
    levelName: 'Bachillerato',
    sortOrder: 16,
  },
  {
    name: '10°',
    levelName: 'Bachillerato',
    sortOrder: 17,
  },
  {
    name: '11°',
    levelName: 'Bachillerato',
    sortOrder: 18,
  },
] as const;

export const AREAS = [
  {
    name: 'Dimensión cognitiva',
    type: AreaType.Dimension,
  },
  {
    name: 'Dimensión comunicativa',
    type: AreaType.Dimension,
  },
  {
    name: 'Dimensión corporal y motora',
    type: AreaType.Dimension,
  },
  {
    name: 'Dimensión estética',
    type: AreaType.Dimension,
  },
  {
    name: 'Dimensión socioafectiva',
    type: AreaType.Dimension,
  },
  {
    name: 'Dimensión espiritual',
    type: AreaType.Dimension,
  },
  {
    name: 'Dimensión ética',
    type: AreaType.Dimension,
  },
  {
    name: 'English (CLIL)',
    type: AreaType.Dimension,
  },
  {
    name: 'Pre-ciencias',
    type: AreaType.Dimension,
  },
  {
    name: 'Lengua Castellana',
    type: AreaType.Subject,
  },
  {
    name: 'Ciencias Naturales',
    type: AreaType.Subject,
  },
  {
    name: 'Ciencias Sociales',
    type: AreaType.Subject,
  },
  {
    name: 'Math',
    type: AreaType.Subject,
  },
  {
    name: 'Science',
    type: AreaType.Subject,
  },
  {
    name: 'English',
    type: AreaType.Subject,
  },
  {
    name: 'Art',
    type: AreaType.Subject,
  },
  {
    name: 'Música',
    type: AreaType.Subject,
  },
  {
    name: 'Deportes',
    type: AreaType.Subject,
  },
  {
    name: 'Social Studies',
    type: AreaType.Subject,
  },
  {
    name: 'Matemáticas',
    type: AreaType.Subject,
  },
  {
    name: 'Tecnología e Informática',
    type: AreaType.Subject,
  },
  {
    name: 'Educación Artística',
    type: AreaType.Subject,
  },
  {
    name: 'Educación Física',
    type: AreaType.Subject,
  },
  {
    name: 'Ética y Valores',
    type: AreaType.Subject,
  },
  {
    name: 'Educación Religiosa',
    type: AreaType.Subject,
  },
  {
    name: 'Física',
    type: AreaType.Subject,
  },
  {
    name: 'Química',
    type: AreaType.Subject,
  },
  {
    name: 'Filosofía',
    type: AreaType.Subject,
  },
  {
    name: 'Ciencias Económicas y Políticas',
    type: AreaType.Subject,
  },
  {
    name: 'Emprendimiento',
    type: AreaType.Subject,
  },
] as const;

/** Periodos del año lectivo, sin fechas hasta que coordinación las defina. */
export const ACADEMIC_PERIOD_NUMBERS = [1, 2, 3] as const;

// Niveles de cada área: relación área–nivel inicial, igual a la regla que `@gns/shared` tuvo
// hasta la #99 (`areaNamesForLevel`). Desde ahora es dato editable desde «Grados y áreas».
const PRESCHOOL_AREA_NAMES: readonly string[] = [
  'Dimensión cognitiva',
  'Dimensión comunicativa',
  'Dimensión corporal y motora',
  'Dimensión estética',
  'Dimensión socioafectiva',
  'Dimensión espiritual',
  'Dimensión ética',
  'English (CLIL)',
  'Pre-ciencias',
  'Lengua Castellana',
  'Ciencias Naturales',
  'Ciencias Sociales',
  'Math',
  'Science',
  'Art',
  'Música',
  'Deportes',
  'Social Studies',
];
const PRIMARY_AREA_NAMES: readonly string[] = [
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
  'Matemáticas',
  'Tecnología e Informática',
  'Educación Artística',
  'Educación Física',
  'Ética y Valores',
  'Educación Religiosa',
];
const SECONDARY_AREA_NAMES: readonly string[] = [
  ...PRIMARY_AREA_NAMES,
  'Física',
  'Química',
  'Filosofía',
  'Ciencias Económicas y Políticas',
  'Emprendimiento',
];

export const AREA_LEVELS: readonly { areaName: string; levelName: string }[] = [
  ...PRESCHOOL_AREA_NAMES.map((areaName) => ({ areaName, levelName: 'Preescolar bajo' })),
  ...PRESCHOOL_AREA_NAMES.map((areaName) => ({ areaName, levelName: 'Preescolar alto (KTF)' })),
  ...PRIMARY_AREA_NAMES.map((areaName) => ({ areaName, levelName: 'Primaria' })),
  ...SECONDARY_AREA_NAMES.map((areaName) => ({ areaName, levelName: 'Bachillerato' })),
];

/**
 * Grupos de preescolar del colegio. Primaria y bachillerato (y First Grade) no traen grupos
 * hasta que coordinación los cree desde «Grados y áreas» (o la migración los cree a partir de
 * las asignaciones existentes como «<grado> 1»).
 */
export const GROUPS: readonly { gradeName: string; name: string }[] = [
  ['Red', 2],
  ['Blue', 2],
  ['Purple', 2],
  ['Green', 3],
  ['Garden', 3],
  ['Kinder', 6],
  ['Transition', 6],
].flatMap(([gradeName, count]) =>
  Array.from({ length: Number(count) }, (_, index) => ({
    gradeName: String(gradeName),
    name: `${String(gradeName)} ${index + 1}`,
  })),
);
