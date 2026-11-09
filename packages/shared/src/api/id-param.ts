import { z } from 'zod';

/** Parámetro de ruta `:id` de los recursos con llave UUID. */
export const idParamSchema = z.object({
  id: z.uuid({ error: 'debe ser un UUID' }),
});
export type IdParam = z.infer<typeof idParamSchema>;
