import { levelAllowsCuriocity, type LessonPlanAdjustableField } from '@gns/shared';

import {
  ADJUSTABLE_FIELD_LABELS,
  MOMENTS,
  type MomentField,
} from '@/shared/records/lesson-plan-fields';

/** Clave estable de un bloque: la de la API, o `dates` para las dos fechas juntas. */
export type BlockKey =
  | 'dates'
  | 'learningCorner'
  | 'curiocityStage'
  | 'topic'
  | 'expectedPerformance'
  | MomentField
  | 'resources'
  | 'reasonableAdjustments'
  | 'linkedResources';

export interface PlanBlock {
  key: BlockKey;
  label: string;
  /** Campos de la API que coordinación ajusta en el bloque (vacío: bloque de solo lectura). */
  fields: readonly LessonPlanAdjustableField[];
}

export interface PlanSection {
  id: string;
  title: string;
  blocks: readonly PlanBlock[];
}

/** Bloque de un solo campo (las dos fechas son un bloque aparte). */
const field = (key: Exclude<LessonPlanAdjustableField, 'dateFrom' | 'dateTo'>): PlanBlock => ({
  key,
  label: ADJUSTABLE_FIELD_LABELS[key],
  fields: [key],
});

/**
 * Bloques de la planeación agrupados como en el tablero. La etapa CurioCity solo existe en
 * bachillerato; el proyecto transversal lo calcula el servidor y va en el encabezado. Los recursos
 * digitales son de solo lectura: la API solo deja gestionarlos a quien creó la planeación.
 */
export function planSections(levelName: string): PlanSection[] {
  const general: PlanBlock[] = [
    { key: 'dates', label: 'Fechas', fields: ['dateFrom', 'dateTo'] },
    field('learningCorner'),
    ...(levelAllowsCuriocity(levelName) ? [field('curiocityStage')] : []),
  ];
  return [
    { id: 'datos', title: 'Datos generales', blocks: general },
    {
      id: 'proposito',
      title: 'Propósito',
      blocks: [field('topic'), field('expectedPerformance')],
    },
    { id: 'momentos', title: 'Momentos de la clase', blocks: MOMENTS.map((m) => field(m.field)) },
    {
      id: 'recursos',
      title: 'Recursos y D.U.A',
      blocks: [field('resources'), field('reasonableAdjustments')],
    },
    {
      id: 'digitales',
      title: 'Recursos digitales',
      blocks: [{ key: 'linkedResources', label: 'Recursos digitales', fields: [] }],
    },
  ];
}

/** Bloques que se pueden observar o ajustar, en el orden de la pantalla. */
export function reviewableBlocks(levelName: string): PlanBlock[] {
  return planSections(levelName)
    .flatMap((section) => section.blocks)
    .filter((block) => block.fields.length > 0);
}

/** Bloque al que pertenece un campo de la API. */
export function blockOfField(fieldKey: LessonPlanAdjustableField): BlockKey {
  return fieldKey === 'dateFrom' || fieldKey === 'dateTo' ? 'dates' : fieldKey;
}

const BLOCK_KEYS: readonly string[] = [
  'dates',
  'learningCorner',
  'curiocityStage',
  'topic',
  'expectedPerformance',
  ...MOMENTS.map((moment) => moment.field),
  'resources',
  'reasonableAdjustments',
];

/** Bloque de un error `changes.<campo>` de un 400 de la API; `null` si no es de un campo ajustable. */
export function blockOfChangesError(errorField: string): BlockKey | null {
  const match = /^changes\.([A-Za-z]+)/u.exec(errorField);
  const key = match?.[1];
  if (!key) {
    return null;
  }
  if (key === 'dateFrom' || key === 'dateTo') {
    return 'dates';
  }
  return BLOCK_KEYS.includes(key) ? (key as BlockKey) : null;
}
