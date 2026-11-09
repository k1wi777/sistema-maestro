import { z } from 'zod';
import { activityKey, shortText } from './common';

const httpsUrl = z.url({ protocol: /^https$/, error: 'La URL debe usar https.' }).max(500);

const cardSchema = z.strictObject({
  clave: activityKey,
  emoji: shortText(8),
  titulo_corto: shortText(40),
  titulo: shortText(80),
  dato: shortText(200),
  hechos: z.array(shortText(300)).min(1).max(6),
  enlace: z.strictObject({ texto: shortText(60), url: httpsUrl }).optional(),
  pregunta: z
    .strictObject({
      enunciado: shortText(200),
      opciones: z.array(shortText(120)).min(2).max(4),
      correcta: z.number().int().min(0),
    })
    .refine((question) => question.correcta < question.opciones.length, {
      path: ['correcta'],
      message: 'La respuesta correcta debe ser una posición de las opciones.',
    }),
});

/** Ruleta de tarjetas y pasaporte de sellos: cada tarjeta respondida otorga un sello. */
export const wheelPassportConfigSchema = z
  .strictObject({
    insignia: shortText(80),
    tarjetas: z.array(cardSchema).min(2).max(20),
  })
  .superRefine((config, context) => {
    const seen = new Set<string>();
    config.tarjetas.forEach((card, index) => {
      if (seen.has(card.clave)) {
        context.addIssue({
          code: 'custom',
          path: ['tarjetas', index, 'clave'],
          message: 'La clave de la tarjeta está repetida.',
        });
      }
      seen.add(card.clave);
    });
  });
export type WheelPassportConfig = z.infer<typeof wheelPassportConfigSchema>;

/** Sellos ganados; el pasaporte se completa cuando están todas las tarjetas. */
export const wheelPassportDetailSchema = z.strictObject({
  sellos: z.array(activityKey).max(20),
});
export type WheelPassportDetail = z.infer<typeof wheelPassportDetailSchema>;
