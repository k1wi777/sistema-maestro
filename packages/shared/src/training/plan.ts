import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { schoolYearSchema } from '../structure/school-year';

export const TRAINING_PLAN_NAME_MAX_LENGTH = 120;

const planName = z
  .string({ error: 'debe ser texto' })
  .trim()
  .min(1, 'no puede estar vacío')
  .max(TRAINING_PLAN_NAME_MAX_LENGTH);

/** `areaId` vacío = plan General; `schoolYear` vacío = vale para cualquier año. */
export const createTrainingPlanSchema = z.strictObject({
  name: planName,
  areaId: z.uuid().nullable().default(null),
  schoolYear: schoolYearSchema.nullable().default(null),
});
export type CreateTrainingPlanInput = z.output<typeof createTrainingPlanSchema>;

/** El área de un plan no cambia. */
export const updateTrainingPlanSchema = z.strictObject({
  name: planName.optional(),
  schoolYear: schoolYearSchema.nullable().optional(),
});
export type UpdateTrainingPlanInput = z.output<typeof updateTrainingPlanSchema>;

export const trainingPlanSchema = z.object({
  id: z.uuid(),
  areaId: z.uuid().nullable(),
  name: z.string(),
  schoolYear: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type TrainingPlan = z.output<typeof trainingPlanSchema>;

/** Plan con su área y el conteo de módulos por estado (listado de coordinación). */
export const trainingPlanSummarySchema = trainingPlanSchema.extend({
  areaName: z.string().nullable(),
  moduleCounts: z.object({
    draft: z.number().int(),
    active: z.number().int(),
    outOfPlan: z.number().int(),
  }),
});
export type TrainingPlanSummary = z.output<typeof trainingPlanSummarySchema>;

export const trainingPlanListSchema = z.object({ items: z.array(trainingPlanSummarySchema) });
export type TrainingPlanList = z.output<typeof trainingPlanListSchema>;
