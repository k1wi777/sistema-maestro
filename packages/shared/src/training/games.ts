import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { ChallengeQuestionType } from '../constants/training';

/**
 * Margen que se suma al tiempo de una pregunta o ronda para absorber la latencia de la red:
 * pasado ese límite, medido con el reloj del servidor, la respuesta cuenta como incorrecta.
 */
export const GAME_LATENCY_MARGIN_SECONDS = 2;

const nullableDate = isoDateTimeSchema.nullable();

/** Resultado de una partida terminada, del Desafío o de una actividad con puntaje. */
export const gameResultSchema = z.strictObject({
  score: z.number().int(),
  points: z.number().int(),
  passed: z.boolean(),
  bestScore: z.number().int(),
  bestPoints: z.number().int(),
  completedAt: nullableDate,
});
export type GameResult = z.output<typeof gameResultSchema>;

// ---------- Desafío GNS ----------

const questionTypes = Object.values(ChallengeQuestionType) as [
  ChallengeQuestionType,
  ...ChallengeQuestionType[],
];

/** Pregunta en curso, sin respuesta correcta; las opciones llegan mezcladas. */
export const challengeQuestionPayloadSchema = z.strictObject({
  id: z.uuid(),
  type: z.enum(questionTypes),
  prompt: z.string(),
  seconds: z.number().int(),
  options: z.array(z.strictObject({ id: z.uuid(), text: z.string() })).optional(),
});
export type ChallengeQuestionPayload = z.output<typeof challengeQuestionPayloadSchema>;

export const challengeStepSchema = z.strictObject({
  total: z.number().int(),
  position: z.number().int(),
  question: challengeQuestionPayloadSchema,
});
export type ChallengeStep = z.output<typeof challengeStepSchema>;

/** Respuesta según el tipo de pregunta; `null` es tiempo agotado. */
const challengeAnswerValueSchema = z.union([
  z.strictObject({ optionId: z.uuid() }),
  z.strictObject({ value: z.boolean() }),
  z.strictObject({ optionIds: z.array(z.uuid()).min(2).max(5) }),
]);

export const challengeAnswerBodySchema = z.strictObject({
  questionId: z.uuid(),
  answer: challengeAnswerValueSchema.nullable(),
});
export type ChallengeAnswerBody = z.output<typeof challengeAnswerBodySchema>;

export const challengeAnswerResultSchema = z.strictObject({
  correct: z.boolean(),
  timedOut: z.boolean(),
  correctAnswer: challengeAnswerValueSchema,
  feedback: z.string().nullable(),
  pointsGained: z.number().int(),
  streak: z.number().int(),
  totalPoints: z.number().int(),
  position: z.number().int(),
  finished: z.boolean(),
  result: gameResultSchema.optional(),
});
export type ChallengeAnswerResult = z.output<typeof challengeAnswerResultSchema>;

// ---------- Conecta ----------

export const matchRoundSchema = z.strictObject({
  round: z.number().int(),
  totalRounds: z.number().int(),
  seconds: z.number().int(),
  concepts: z.array(
    z.strictObject({ token: z.string(), concepto: z.string(), emoji: z.string().optional() }),
  ),
  facts: z.array(z.strictObject({ token: z.string(), dato: z.string() })),
});
export type MatchRound = z.output<typeof matchRoundSchema>;

export const matchAnswerBodySchema = z.strictObject({
  conceptToken: z.string().min(1).max(64),
  factToken: z.string().min(1).max(64),
});
export type MatchAnswerBody = z.output<typeof matchAnswerBodySchema>;

export const matchAnswerResultSchema = z.strictObject({
  type: z.literal('conecta'),
  correct: z.boolean(),
  firstAttempt: z.boolean(),
  pointsGained: z.number().int(),
  streak: z.number().int(),
  totalPoints: z.number().int(),
  connected: z.number().int(),
  roundOver: z.boolean(),
  finished: z.boolean(),
  result: gameResultSchema.optional(),
});
export type MatchAnswerResult = z.output<typeof matchAnswerResultSchema>;

// ---------- Verdad o mito ----------

export const statementPayloadSchema = z.strictObject({
  position: z.number().int(),
  text: z.string(),
  seconds: z.number().int(),
});

export const trueOrMythAnswerBodySchema = z.strictObject({
  position: z.number().int().min(1),
  value: z.boolean().nullable(),
});
export type TrueOrMythAnswerBody = z.output<typeof trueOrMythAnswerBodySchema>;

export const trueOrMythAnswerResultSchema = z.strictObject({
  type: z.literal('verdad_o_mito'),
  correct: z.boolean(),
  timedOut: z.boolean(),
  isTrue: z.boolean(),
  explanation: z.string(),
  lives: z.number().int(),
  pointsGained: z.number().int(),
  streak: z.number().int(),
  totalPoints: z.number().int(),
  position: z.number().int(),
  finished: z.boolean(),
  result: gameResultSchema.optional(),
});
export type TrueOrMythAnswerResult = z.output<typeof trueOrMythAnswerResultSchema>;

// ---------- Endpoints comunes de actividades con partida ----------

export const activityGameStepSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('conecta'),
    finished: z.boolean(),
    round: matchRoundSchema.optional(),
    result: gameResultSchema.optional(),
  }),
  z.strictObject({
    type: z.literal('verdad_o_mito'),
    finished: z.boolean(),
    total: z.number().int(),
    lives: z.number().int(),
    statement: statementPayloadSchema.optional(),
    result: gameResultSchema.optional(),
  }),
]);
export type ActivityGameStep = z.output<typeof activityGameStepSchema>;

/** `answer` de una actividad: la forma del cuerpo y de la respuesta depende de su tipo. */
export const activityGameAnswerBodySchema = z.union([
  matchAnswerBodySchema,
  trueOrMythAnswerBodySchema,
]);
export type ActivityGameAnswerBody = z.output<typeof activityGameAnswerBodySchema>;

export const activityGameAnswerResultSchema = z.discriminatedUnion('type', [
  matchAnswerResultSchema,
  trueOrMythAnswerResultSchema,
]);
export type ActivityGameAnswerResult = z.output<typeof activityGameAnswerResultSchema>;

/** Los endpoints de partida no reciben nada al iniciar ni al pasar al siguiente. */
export const emptyBodySchema = z.strictObject({});
