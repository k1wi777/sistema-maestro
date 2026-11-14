import { z } from 'zod';

export const ORDER_MAX_ITEMS = 200;

/** Lista completa y sin repetidos de los hijos actuales, en el nuevo orden (R7). */
export const orderSchema = z
  .strictObject({
    ids: z
      .array(z.uuid({ error: 'debe ser un UUID' }))
      .min(1)
      .max(ORDER_MAX_ITEMS),
  })
  .refine((body) => new Set(body.ids).size === body.ids.length, {
    path: ['ids'],
    message: 'La lista no puede repetir elementos.',
  });
export type OrderInput = z.output<typeof orderSchema>;
