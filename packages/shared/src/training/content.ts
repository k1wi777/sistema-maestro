import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import {
  ChallengeQuestionType,
  TrainingActivityStatus,
  TrainingActivityType,
} from '../constants/training';
import { activityInstructionsSchema, parseActivityConfig } from '../training-activities';
import { shortText } from '../training-activities/common';

// ---------- Diapositivas ----------

export const SLIDE_KEY_IDEAS_MAX_LENGTH = 2000;

/** Una idea clave por línea. */
const slideFields = {
  title: shortText(160).nullable(),
  keyIdeas: z.string({ error: 'debe ser texto' }).trim().max(SLIDE_KEY_IDEAS_MAX_LENGTH),
};
export const createSlideSchema = z.strictObject({
  title: slideFields.title.default(null),
  keyIdeas: slideFields.keyIdeas,
});
export type CreateSlideInput = z.output<typeof createSlideSchema>;

export const updateSlideSchema = z.strictObject({
  title: slideFields.title.optional(),
  keyIdeas: slideFields.keyIdeas.optional(),
});
export type UpdateSlideInput = z.output<typeof updateSlideSchema>;

export const slideSchema = z.object({
  id: z.uuid(),
  sortOrder: z.number().int(),
  title: z.string().nullable(),
  keyIdeas: z.string().nullable(),
});
export type Slide = z.output<typeof slideSchema>;

// ---------- Preguntas del Desafío ----------

export const QUESTION_OPTIONS_LIMITS = { min: 2, max: 4 } as const;
export const QUESTION_ORDER_STEPS_LIMITS = { min: 2, max: 5 } as const;

const prompt = z.string({ error: 'debe ser texto' }).trim().min(1).max(500);
const feedback = z.string({ error: 'debe ser texto' }).trim().max(500).nullable().default(null);

/**
 * Pregunta según su tipo: `opcion` con 2 a 4 opciones y una sola correcta, `vf` con su respuesta
 * y `orden` con 2 a 5 pasos en el orden correcto (4 es el tope del editor del prototipo; 5, el
 * máximo de los datos iniciales).
 */
export const challengeQuestionInputSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal(ChallengeQuestionType.MultipleChoice),
    prompt,
    feedback,
    options: z
      .array(z.strictObject({ text: shortText(200), isCorrect: z.boolean() }))
      .min(QUESTION_OPTIONS_LIMITS.min)
      .max(QUESTION_OPTIONS_LIMITS.max)
      .refine((options) => options.filter((option) => option.isCorrect).length === 1, {
        message: 'Debe haber exactamente una opción correcta.',
      }),
  }),
  z.strictObject({
    type: z.literal(ChallengeQuestionType.TrueFalse),
    prompt,
    feedback,
    trueFalseAnswer: z.boolean(),
  }),
  z.strictObject({
    type: z.literal(ChallengeQuestionType.Ordering),
    prompt,
    feedback,
    steps: z
      .array(shortText(200))
      .min(QUESTION_ORDER_STEPS_LIMITS.min)
      .max(QUESTION_ORDER_STEPS_LIMITS.max),
  }),
]);
export type ChallengeQuestionInput = z.output<typeof challengeQuestionInputSchema>;

const questionTypes = Object.values(ChallengeQuestionType) as [
  ChallengeQuestionType,
  ...ChallengeQuestionType[],
];

export const challengeQuestionSchema = z.object({
  id: z.uuid(),
  sortOrder: z.number().int(),
  type: z.enum(questionTypes),
  prompt: z.string(),
  feedback: z.string().nullable(),
  trueFalseAnswer: z.boolean().nullable(),
  options: z.array(
    z.object({
      id: z.uuid(),
      text: z.string(),
      isCorrect: z.boolean().nullable(),
      correctPosition: z.number().int().nullable(),
    }),
  ),
});
export type ChallengeQuestion = z.output<typeof challengeQuestionSchema>;

// ---------- Actividades ----------

const activityTypes = Object.values(TrainingActivityType) as [
  TrainingActivityType,
  ...TrainingActivityType[],
];
const activityStatuses = Object.values(TrainingActivityStatus) as [
  TrainingActivityStatus,
  ...TrainingActivityStatus[],
];

const activityTitle = shortText(160);

/** El tipo fija el esquema de `config`. */
export const createActivitySchema = z
  .strictObject({
    type: z.enum(activityTypes),
    title: activityTitle,
    isRequired: z.boolean(),
    instructions: activityInstructionsSchema.default(null),
    config: z.unknown(),
  })
  .superRefine((activity, context) => {
    const parsed = parseActivityConfig(activity.type, activity.config);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        context.addIssue({
          code: 'custom',
          path: ['config', ...issue.path],
          message: issue.message,
        });
      }
    }
  });
export type CreateActivityInput = z.output<typeof createActivitySchema>;

/** Estricto y sin `type`: el progreso y el detalle dependen del tipo (R11). */
export const updateActivitySchema = z.strictObject({
  title: activityTitle.optional(),
  isRequired: z.boolean().optional(),
  instructions: activityInstructionsSchema.optional(),
  config: z.unknown().optional(),
});
export type UpdateActivityInput = z.output<typeof updateActivitySchema>;

export const activitySchema = z.object({
  id: z.uuid(),
  type: z.enum(activityTypes),
  sortOrder: z.number().int(),
  title: z.string(),
  isRequired: z.boolean(),
  instructions: z.string().nullable(),
  status: z.enum(activityStatuses),
  config: z.record(z.string(), z.unknown()),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Activity = z.output<typeof activitySchema>;
