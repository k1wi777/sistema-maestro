import { z } from 'zod';
import { approvalThreshold, shortText } from './common';

/** Conecta: parejas concepto–dato contra el tiempo. */
export const matchConfigSchema = z
  .strictObject({
    pares: z
      .array(
        z.strictObject({
          concepto: shortText(80),
          dato: shortText(200),
          emoji: shortText(8).optional(),
        }),
      )
      .min(2)
      .max(40),
    pares_por_ronda: z.number().int().min(2).max(10),
    rondas: z.number().int().min(1).max(10),
    segundos_por_ronda: z.number().int().min(5).max(600),
    umbral_aprobacion: approvalThreshold,
  })
  .refine((config) => config.pares.length >= config.pares_por_ronda * config.rondas, {
    path: ['pares'],
    message: 'Se necesitan al menos pares_por_ronda × rondas pares.',
  });
export type MatchConfig = z.infer<typeof matchConfigSchema>;
