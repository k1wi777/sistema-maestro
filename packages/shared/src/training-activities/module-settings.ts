import { z } from 'zod';
import { ChallengeQuestionType } from '../constants/training';
import { approvalThreshold, shortText } from './common';

/** Umbral de aprobación del Desafío GNS cuando el módulo no define otro. */
export const CHALLENGE_DEFAULT_APPROVAL_THRESHOLD = 80;

/** Tiempo vigente por tipo de pregunta cuando el módulo no fija `segundos_por_pregunta`. */
export const CHALLENGE_DEFAULT_SECONDS_PER_QUESTION: Record<ChallengeQuestionType, number> = {
  [ChallengeQuestionType.MultipleChoice]: 20,
  [ChallengeQuestionType.TrueFalse]: 15,
  [ChallengeQuestionType.Ordering]: 35,
};

export const CHALLENGE_SECONDS_PER_QUESTION_LIMITS = { min: 5, max: 120 } as const;

/** Columnas de presentación y calificación de `modulo_formacion` añadidas en BE-1 #8. */
export const trainingModuleSettingsSchema = z.strictObject({
  video_titulo: shortText(160).nullable(),
  umbral_aprobacion: approvalThreshold,
  segundos_por_pregunta: z
    .number()
    .int()
    .min(CHALLENGE_SECONDS_PER_QUESTION_LIMITS.min)
    .max(CHALLENGE_SECONDS_PER_QUESTION_LIMITS.max)
    .nullable(),
});
export type TrainingModuleSettings = z.infer<typeof trainingModuleSettingsSchema>;

/** Instrucciones opcionales de una actividad (`actividad_modulo.instrucciones`). */
export const activityInstructionsSchema = shortText(500).nullable();
