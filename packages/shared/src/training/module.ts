import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { TrainingModuleStatus } from '../constants/training';
import { shortText } from '../training-activities/common';
import { trainingModuleSettingsSchema } from '../training-activities/module-settings';
import { activitySchema, challengeQuestionSchema, slideSchema } from './content';
import { moduleFileSummarySchema } from './files';
import { parseYouTubeUrl, VideoSource } from './youtube';

const httpsUrl = z
  .url({ protocol: /^https$/, error: 'La URL debe usar https.' })
  .max(500)
  .nullable();

/** El video del módulo es un enlace de YouTube (o un archivo subido, R6). */
const youtubeUrl = z
  .string({ error: 'debe ser texto' })
  .max(500)
  .refine((value) => parseYouTubeUrl(value) !== null, {
    error: 'El video debe ser un enlace de YouTube (youtube.com o youtu.be).',
  })
  .nullable();

const settings = trainingModuleSettingsSchema.shape;

const moduleFields = {
  number: z.string({ error: 'debe ser texto' }).trim().min(1).max(4).nullable(),
  title: shortText(160),
  summary: z.string({ error: 'debe ser texto' }).trim().max(500).nullable(),
  videoUrl: youtubeUrl,
  videoTitle: settings.video_titulo,
  presentationUrl: httpsUrl,
  approvalThreshold: settings.umbral_aprobacion,
  secondsPerQuestion: settings.segundos_por_pregunta,
};

/** Un módulo nuevo nace en borrador al final de su sección (R3). */
export const createTrainingModuleSchema = z.strictObject({
  number: moduleFields.number.default(null),
  title: moduleFields.title,
  summary: moduleFields.summary.default(null),
  videoUrl: moduleFields.videoUrl.default(null),
  videoTitle: moduleFields.videoTitle.default(null),
  presentationUrl: moduleFields.presentationUrl.default(null),
  approvalThreshold: moduleFields.approvalThreshold.default(80),
  secondsPerQuestion: moduleFields.secondsPerQuestion.default(null),
});
export type CreateTrainingModuleInput = z.output<typeof createTrainingModuleSchema>;

/** `sectionId` mueve el módulo a otra sección del mismo plan (R6). */
export const updateTrainingModuleSchema = z.strictObject({
  number: moduleFields.number.optional(),
  title: moduleFields.title.optional(),
  summary: moduleFields.summary.optional(),
  videoUrl: moduleFields.videoUrl.optional(),
  videoTitle: moduleFields.videoTitle.optional(),
  presentationUrl: moduleFields.presentationUrl.optional(),
  approvalThreshold: moduleFields.approvalThreshold.optional(),
  secondsPerQuestion: moduleFields.secondsPerQuestion.optional(),
  sectionId: z.uuid().optional(),
});
export type UpdateTrainingModuleInput = z.output<typeof updateTrainingModuleSchema>;

const moduleStatuses = Object.values(TrainingModuleStatus) as [
  TrainingModuleStatus,
  ...TrainingModuleStatus[],
];

export const trainingModuleSchema = z.object({
  id: z.uuid(),
  planId: z.uuid(),
  sectionId: z.uuid(),
  number: z.string().nullable(),
  sortOrder: z.number().int(),
  title: z.string(),
  summary: z.string().nullable(),
  videoUrl: z.string().nullable(),
  videoTitle: z.string().nullable(),
  presentationUrl: z.string().nullable(),
  videoSource: z.enum(Object.values(VideoSource) as [VideoSource, ...VideoSource[]]).nullable(),
  videoEmbedUrl: z.string().nullable(),
  videoFile: moduleFileSummarySchema.nullable(),
  presentationFile: moduleFileSummarySchema.nullable(),
  status: z.enum(moduleStatuses),
  approvalThreshold: z.number().int(),
  secondsPerQuestion: z.number().int().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type TrainingModule = z.output<typeof trainingModuleSchema>;

/** Editor completo de coordinación: incluye las soluciones. */
export const trainingModuleDetailSchema = trainingModuleSchema.extend({
  slides: z.array(slideSchema),
  questions: z.array(challengeQuestionSchema),
  activities: z.array(activitySchema),
});
export type TrainingModuleDetail = z.output<typeof trainingModuleDetailSchema>;
