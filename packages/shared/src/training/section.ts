import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { TrainingModuleStatus } from '../constants/training';
import { trainingPlanSchema } from './plan';

const sectionTitle = z.string({ error: 'debe ser texto' }).trim().min(1).max(120);
const sectionSubtitle = z.string({ error: 'debe ser texto' }).trim().max(200);

export const createTrainingSectionSchema = z.strictObject({
  title: sectionTitle,
  subtitle: sectionSubtitle.nullable().default(null),
});
export type CreateTrainingSectionInput = z.output<typeof createTrainingSectionSchema>;

export const updateTrainingSectionSchema = z.strictObject({
  title: sectionTitle.optional(),
  subtitle: sectionSubtitle.nullable().optional(),
});
export type UpdateTrainingSectionInput = z.output<typeof updateTrainingSectionSchema>;

export const trainingSectionSchema = z.object({
  id: z.uuid(),
  planId: z.uuid(),
  title: z.string(),
  subtitle: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type TrainingSection = z.output<typeof trainingSectionSchema>;

/** Módulo dentro del árbol de edición (todos los estados). */
export const trainingModuleOutlineSchema = z.object({
  id: z.uuid(),
  number: z.string().nullable(),
  sortOrder: z.number().int(),
  title: z.string(),
  status: z.enum(
    Object.values(TrainingModuleStatus) as [TrainingModuleStatus, ...TrainingModuleStatus[]],
  ),
  slideCount: z.number().int(),
  questionCount: z.number().int(),
  activityCount: z.number().int(),
});
export type TrainingModuleOutline = z.output<typeof trainingModuleOutlineSchema>;

export const trainingSectionWithModulesSchema = trainingSectionSchema.extend({
  modules: z.array(trainingModuleOutlineSchema),
});
export type TrainingSectionWithModules = z.output<typeof trainingSectionWithModulesSchema>;

/** Árbol de edición de un plan: secciones en orden con sus módulos. */
export const trainingPlanTreeSchema = z.object({
  plan: trainingPlanSchema,
  sections: z.array(trainingSectionWithModulesSchema),
});
export type TrainingPlanTree = z.output<typeof trainingPlanTreeSchema>;
