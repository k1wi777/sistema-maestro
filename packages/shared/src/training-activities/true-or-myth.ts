import { z } from 'zod';
import { approvalThreshold, shortText } from './common';

/** Verdad o mito: afirmaciones con vidas y racha. */
export const trueOrMythConfigSchema = z
  .strictObject({
    afirmaciones: z
      .array(
        z.strictObject({
          texto: shortText(300),
          es_verdad: z.boolean(),
          explicacion: shortText(300),
        }),
      )
      .min(1)
      .max(60),
    por_partida: z.number().int().min(1).max(60),
    vidas: z.number().int().min(1).max(10),
    segundos_por_afirmacion: z.number().int().min(3).max(120),
    umbral_aprobacion: approvalThreshold,
  })
  .refine((config) => config.por_partida <= config.afirmaciones.length, {
    path: ['por_partida'],
    message: 'Una partida no puede tener más afirmaciones que las configuradas.',
  });
export type TrueOrMythConfig = z.infer<typeof trueOrMythConfigSchema>;
