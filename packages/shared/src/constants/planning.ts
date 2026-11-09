/** Etapa CurioCity de una planeación de bachillerato (`planeacion.etapa_curiocity`). */
export const CuriocityStage = {
  Investigate: 'Investigo',
  Interact: 'Interactúo',
  Create: 'Creo',
  Present: 'Presento',
} as const;
export type CuriocityStage = (typeof CuriocityStage)[keyof typeof CuriocityStage];

/** Herramienta digital que la API admite al agregar un enlace (`recurso_planeacion.herramienta`). */
export const DigitalTool = {
  Canva: 'Canva',
  Liveworksheets: 'Liveworksheets',
  Kahoot: 'Kahoot',
  ClassDojo: 'ClassDojo',
  Pinterest: 'Pinterest',
  Other: 'Otra',
} as const;
export type DigitalTool = (typeof DigitalTool)[keyof typeof DigitalTool];

/** Tope de enlaces digitales de una planeación. */
export const LESSON_PLAN_MAX_RESOURCES = 30;

/** Momentos de la clase a los que se puede asociar un enlace (1 a 4). */
export const LESSON_PLAN_MOMENTS = [1, 2, 3, 4] as const;

/**
 * Campos de contenido de una planeación que coordinación puede ajustar: clave de la API
 * y columna de la base. `revision.campos_ajustados` y `revision.cambios` usan la columna;
 * la interfaz las traduce a etiquetas con este mapa.
 */
export const LESSON_PLAN_ADJUSTABLE_FIELDS = {
  dateFrom: 'fecha_desde',
  dateTo: 'fecha_hasta',
  topic: 'tema',
  expectedPerformance: 'desempeno_esperado',
  learningCorner: 'rincon',
  curiocityStage: 'etapa_curiocity',
  explorationMoment: 'momento_exploracion',
  developmentMoment: 'momento_desarrollo',
  socializationMoment: 'momento_socializacion',
  closingMoment: 'momento_cierre',
  resources: 'recursos',
  reasonableAdjustments: 'ajustes_razonables',
} as const;
export type LessonPlanAdjustableField = keyof typeof LESSON_PLAN_ADJUSTABLE_FIELDS;
