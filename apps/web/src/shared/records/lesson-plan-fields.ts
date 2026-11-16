import { LESSON_PLAN_ADJUSTABLE_FIELDS, type LessonPlanAdjustableField } from '@gns/shared';

export type MomentField =
  'explorationMoment' | 'developmentMoment' | 'socializationMoment' | 'closingMoment';

export interface Moment {
  number: 1 | 2 | 3 | 4;
  field: MomentField;
  /** Nombre completo del momento, como en el tablero. */
  title: string;
  /** Nombre corto para menús y mensajes. */
  short: string;
}

export const MOMENTS: readonly Moment[] = [
  {
    number: 1,
    field: 'explorationMoment',
    title: 'Exploración o motivación',
    short: 'Exploración',
  },
  {
    number: 2,
    field: 'developmentMoment',
    title: 'Desarrollo o experiencia en el rincón',
    short: 'Desarrollo',
  },
  { number: 3, field: 'socializationMoment', title: 'Socialización', short: 'Socialización' },
  { number: 4, field: 'closingMoment', title: 'Cierre', short: 'Cierre' },
];

/** Clave de la API a partir de la columna que guarda el historial de revisión. */
export const FIELD_BY_COLUMN: Record<string, LessonPlanAdjustableField> = Object.fromEntries(
  Object.entries(LESSON_PLAN_ADJUSTABLE_FIELDS).map(([key, column]) => [
    column,
    key as LessonPlanAdjustableField,
  ]),
);

/** Etiquetas en español de los campos que coordinación puede ajustar. */
export const ADJUSTABLE_FIELD_LABELS: Record<LessonPlanAdjustableField, string> = {
  dateFrom: 'Fecha de inicio',
  dateTo: 'Fecha final',
  topic: 'Proyecto o tema',
  expectedPerformance: 'Desempeño esperado',
  learningCorner: 'Rincón o zona',
  curiocityStage: 'Etapa CurioCity',
  explorationMoment: 'Momento 1 · Exploración',
  developmentMoment: 'Momento 2 · Desarrollo',
  socializationMoment: 'Momento 3 · Socialización',
  closingMoment: 'Momento 4 · Cierre',
  resources: 'Recursos y materiales',
  reasonableAdjustments: 'Ajustes razonables',
};
