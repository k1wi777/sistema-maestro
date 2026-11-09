import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { DigitalTool, LESSON_PLAN_MOMENTS } from '../constants/planning';

export const RESOURCE_NAME_MAX_LENGTH = 120;
export const RESOURCE_URL_MAX_LENGTH = 2048;

/** La respuesta tipa `tool` como texto: los datos demo traen herramientas fuera del enum de entrada. */
export const lessonPlanResourceSchema = z.object({
  id: z.uuid(),
  tool: z.string(),
  name: z.string().nullable(),
  url: z.string(),
  moment: z.number().int().nullable(),
  createdAt: isoDateTimeSchema,
});
export type LessonPlanResource = z.output<typeof lessonPlanResourceSchema>;

/** URL absoluta `http` o `https`: rechaza `javascript:`, `data:`, `ftp:` y rutas relativas. */
export const resourceUrlSchema = z
  .url({ protocol: /^https?$/, error: 'debe ser una URL absoluta http o https' })
  .max(RESOURCE_URL_MAX_LENGTH, `debe tener como máximo ${RESOURCE_URL_MAX_LENGTH} caracteres`);

export const createLessonPlanResourceSchema = z
  .object({
    tool: z.enum(Object.values(DigitalTool) as [DigitalTool, ...DigitalTool[]], {
      error: 'herramienta no permitida',
    }),
    name: z
      .string({ error: 'debe ser texto' })
      .trim()
      .min(1, 'no puede estar vacío')
      .max(
        RESOURCE_NAME_MAX_LENGTH,
        `debe tener como máximo ${RESOURCE_NAME_MAX_LENGTH} caracteres`,
      ),
    url: resourceUrlSchema,
    /** Momento de la clase 1 a 4; sin él (o `null`) el enlace es general. */
    moment: z
      .number({ error: 'debe ser un número' })
      .int('debe ser un entero')
      .refine((value) => (LESSON_PLAN_MOMENTS as readonly number[]).includes(value), {
        error: 'debe ser un momento de 1 a 4',
      })
      .nullable()
      .default(null),
  })
  .strict();
export type CreateLessonPlanResourceInput = z.output<typeof createLessonPlanResourceSchema>;

export const lessonPlanResourceParamsSchema = z.object({
  id: z.uuid({ error: 'debe ser un UUID' }),
  resourceId: z.uuid({ error: 'debe ser un UUID' }),
});
