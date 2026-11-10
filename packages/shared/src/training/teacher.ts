import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { TeacherModuleState, TrainingActivityType } from '../constants/training';

/**
 * Lo que ve el docente. Todos los objetos son estrictos y se construyen por lista blanca
 * (`teacher-projection.ts` en la API): ninguna solución ni retroalimentación sale en ellos (R18).
 */

const moduleStates = Object.values(TeacherModuleState) as [
  TeacherModuleState,
  ...TeacherModuleState[],
];

const nullableDate = isoDateTimeSchema.nullable();

// ---------- Ruta ----------

export const teacherActivitySummarySchema = z.strictObject({
  id: z.uuid(),
  type: z.enum(
    Object.values(TrainingActivityType) as [TrainingActivityType, ...TrainingActivityType[]],
  ),
  title: z.string(),
  isRequired: z.boolean(),
  completedAt: nullableDate,
  bestScore: z.number().int().nullable(),
  stamps: z.strictObject({ done: z.number().int(), total: z.number().int() }).nullable(),
});
export type TeacherActivitySummary = z.output<typeof teacherActivitySummarySchema>;

export const teacherModuleSummarySchema = z.strictObject({
  id: z.uuid(),
  number: z.string().nullable(),
  title: z.string(),
  summary: z.string().nullable(),
  state: z.enum(moduleStates),
  steps: z.strictObject({
    video: z.boolean(),
    presentation: z.boolean(),
    challenge: z.boolean(),
    activities: z.number().int(),
  }),
  bestScore: z.number().int().nullable(),
  completedAt: nullableDate,
  activities: z.array(teacherActivitySummarySchema),
});
export type TeacherModuleSummary = z.output<typeof teacherModuleSummarySchema>;

export const teacherRouteSchema = z.strictObject({
  schoolYear: z.string(),
  plans: z.array(
    z.strictObject({
      id: z.uuid(),
      name: z.string(),
      areaId: z.uuid().nullable(),
      areaName: z.string().nullable(),
      totals: z.strictObject({ modules: z.number().int(), completed: z.number().int() }),
      sections: z.array(
        z.strictObject({
          id: z.uuid(),
          title: z.string(),
          subtitle: z.string().nullable(),
          modules: z.array(teacherModuleSummarySchema),
        }),
      ),
    }),
  ),
});
export type TeacherRoute = z.output<typeof teacherRouteSchema>;

// ---------- Módulo ----------

const wheelCardSchema = z.strictObject({
  clave: z.string(),
  emoji: z.string(),
  titulo_corto: z.string(),
  titulo: z.string(),
  dato: z.string(),
  hechos: z.array(z.string()),
  enlace: z.strictObject({ texto: z.string(), url: z.string() }).optional(),
  // Sin `correcta`: la respuesta se verifica en el servidor.
  pregunta: z.strictObject({ enunciado: z.string(), opciones: z.array(z.string()) }),
});

const activityProgressSchema = z.strictObject({
  completedAt: nullableDate,
  bestScore: z.number().int().nullable(),
  bestPoints: z.number().int().nullable(),
  attempts: z.number().int(),
  stamps: z.array(z.string()),
});

const activityBase = {
  id: z.uuid(),
  title: z.string(),
  isRequired: z.boolean(),
  instructions: z.string().nullable(),
  progress: activityProgressSchema,
};

export const teacherActivitySchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...activityBase,
    type: z.literal(TrainingActivityType.WheelPassport),
    config: z.strictObject({ insignia: z.string(), tarjetas: z.array(wheelCardSchema) }),
  }),
  z.strictObject({
    ...activityBase,
    type: z.literal(TrainingActivityType.Match),
    // Nunca los pares: llegan por tokens durante la partida.
    config: z.strictObject({
      pares_por_ronda: z.number().int(),
      rondas: z.number().int(),
      segundos_por_ronda: z.number().int(),
      umbral_aprobacion: z.number().int(),
    }),
  }),
  z.strictObject({
    ...activityBase,
    type: z.literal(TrainingActivityType.TrueOrMyth),
    config: z.strictObject({
      por_partida: z.number().int(),
      vidas: z.number().int(),
      segundos_por_afirmacion: z.number().int(),
      umbral_aprobacion: z.number().int(),
    }),
  }),
  z.strictObject({
    ...activityBase,
    type: z.literal(TrainingActivityType.Simulator),
    // El simulador no tiene solución: la calculadora corre en el navegador.
    config: z.record(z.string(), z.unknown()),
  }),
]);
export type TeacherActivity = z.output<typeof teacherActivitySchema>;

export const teacherModuleSchema = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  section: z.strictObject({ id: z.uuid(), title: z.string() }),
  number: z.string().nullable(),
  title: z.string(),
  summary: z.string().nullable(),
  videoUrl: z.string().nullable(),
  videoTitle: z.string().nullable(),
  presentationUrl: z.string().nullable(),
  slides: z.array(
    z.strictObject({ id: z.uuid(), title: z.string().nullable(), keyIdeas: z.string().nullable() }),
  ),
  // Las preguntas llegan una a una por la partida: aquí solo cuántas hay y los ajustes.
  challenge: z.strictObject({
    questionCount: z.number().int(),
    approvalThreshold: z.number().int(),
    secondsPerQuestion: z.number().int().nullable(),
  }),
  state: z.enum(moduleStates),
  progress: z.strictObject({
    videoViewedAt: nullableDate,
    presentationViewedAt: nullableDate,
    bestScore: z.number().int().nullable(),
    bestPoints: z.number().int().nullable(),
    attempts: z.number().int(),
    passedAt: nullableDate,
    completedAt: nullableDate,
  }),
  activities: z.array(teacherActivitySchema),
});
export type TeacherModule = z.output<typeof teacherModuleSchema>;

/** Respuesta de las marcas de video y presentación (idempotentes). */
export const viewMarkSchema = z.strictObject({
  viewedAt: isoDateTimeSchema,
  completedAt: nullableDate,
});
export type ViewMark = z.output<typeof viewMarkSchema>;

/** `/use` del simulador: cuerpo vacío estricto (R21). */
export const simulatorUseBodySchema = z.strictObject({});
export const simulatorUseResultSchema = z.strictObject({
  attempts: z.number().int(),
  completedAt: nullableDate,
});
export type SimulatorUseResult = z.output<typeof simulatorUseResultSchema>;

// ---------- Ruleta ----------

export const wheelStampBodySchema = z.strictObject({
  cardKey: z.string().min(1).max(32),
  optionIndex: z.number().int().min(0).max(3),
});
export type WheelStampBody = z.output<typeof wheelStampBodySchema>;

export const wheelStampResultSchema = z.strictObject({
  correct: z.boolean(),
  correctIndex: z.number().int(),
  stamps: z.array(z.string()),
  completedAt: nullableDate,
});
export type WheelStampResult = z.output<typeof wheelStampResultSchema>;
