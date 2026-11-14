import { z } from 'zod';

/**
 * Estado de las partidas en curso (`partida_desafio`, `partida`). Es interno: el cliente nunca
 * lo ve, por eso no vive en `@gns/shared`. Se valida con Zod al leerlo; uno ilegible se trata
 * como una partida que ya no existe (409).
 */

export const GAME_STATE_VERSION = 1;

const instant = z.iso.datetime();

export const challengeGameStateSchema = z.strictObject({
  version: z.literal(GAME_STATE_VERSION),
  kind: z.literal('desafio'),
  startedAt: instant,
  /** Preguntas elegidas, en el orden aleatorio de la partida. */
  questionIds: z.array(z.uuid()).min(1),
  /** Permutación entregada de las opciones de cada pregunta (solo `opcion` y `orden`). */
  optionOrder: z.record(z.uuid(), z.array(z.uuid())),
  /** Posición (desde 0) de la pregunta en curso. */
  position: z.number().int().min(0),
  servedAt: instant,
  answered: z.boolean(),
  correctCount: z.number().int().min(0),
  points: z.number().int().min(0),
  streak: z.number().int().min(0),
  answers: z.array(
    z.strictObject({ questionId: z.uuid(), correct: z.boolean(), timedOut: z.boolean() }),
  ),
});
export type ChallengeGameState = z.output<typeof challengeGameStateSchema>;

const matchPairSchema = z.strictObject({
  /** Posición del par en `pares` de la configuración. */
  index: z.number().int().min(0),
  conceptToken: z.string(),
  factToken: z.string(),
  connected: z.boolean(),
  /** Hubo al menos una pareja equivocada con este concepto. */
  failed: z.boolean(),
});

export const matchGameStateSchema = z.strictObject({
  version: z.literal(GAME_STATE_VERSION),
  kind: z.literal('conecta'),
  startedAt: instant,
  /** `actualizado_en` de la actividad al empezar: si cambia, la partida se descarta. */
  activityUpdatedAt: instant,
  rounds: z.array(
    z.strictObject({
      pairs: z.array(matchPairSchema).min(1),
      conceptOrder: z.array(z.number().int().min(0)),
      factOrder: z.array(z.number().int().min(0)),
    }),
  ),
  roundIndex: z.number().int().min(0),
  servedAt: instant,
  roundOver: z.boolean(),
  points: z.number().int().min(0),
  streak: z.number().int().min(0),
  firstAttempts: z.number().int().min(0),
});
export type MatchGameState = z.output<typeof matchGameStateSchema>;

export const trueOrMythGameStateSchema = z.strictObject({
  version: z.literal(GAME_STATE_VERSION),
  kind: z.literal('verdad_o_mito'),
  startedAt: instant,
  activityUpdatedAt: instant,
  /** Afirmaciones elegidas (posiciones en `afirmaciones`), en el orden de la partida. */
  statementIndexes: z.array(z.number().int().min(0)).min(1),
  position: z.number().int().min(0),
  servedAt: instant,
  answered: z.boolean(),
  lives: z.number().int().min(0),
  correctCount: z.number().int().min(0),
  points: z.number().int().min(0),
  streak: z.number().int().min(0),
});
export type TrueOrMythGameState = z.output<typeof trueOrMythGameStateSchema>;

export function parseGameState<T extends z.ZodType>(schema: T, value: unknown): z.output<T> | null {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
