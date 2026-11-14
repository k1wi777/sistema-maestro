import {
  activityGameAnswerResultSchema,
  activityGameStepSchema,
  activityParamsSchema,
  activitySchema,
  certificateListQuerySchema,
  certificateListSchema,
  certificateVerificationSchema,
  certificateCodeParamSchema,
  challengeAnswerBodySchema,
  challengeAnswerResultSchema,
  challengeQuestionSchema,
  challengeStepSchema,
  confirmModuleFileParamsSchema,
  createActivitySchema,
  createSlideSchema,
  createTrainingModuleSchema,
  createTrainingPlanSchema,
  createTrainingSectionSchema,
  moduleFileParamsSchema,
  moduleFileUploadResultSchema,
  orderSchema,
  planTrackingSchema,
  questionParamsSchema,
  requestModuleFileUploadSchema,
  signedUrlSchema,
  teacherModuleFileParamsSchema,
  simulatorUseBodySchema,
  simulatorUseResultSchema,
  slideParamsSchema,
  slideSchema,
  teacherActivityParamsSchema,
  teacherModuleParamsSchema,
  teacherModuleSchema,
  teacherRouteSchema,
  teacherTrackingSchema,
  trackingPlanParamsSchema,
  trackingTeacherParamsSchema,
  trainingModuleDetailSchema,
  trainingModuleSchema,
  trainingPlanListSchema,
  trainingPlanSchema,
  trainingPlanTreeSchema,
  trainingSectionSchema,
  trainingSectionWithModulesSchema,
  updateActivitySchema,
  updateSlideSchema,
  updateTrainingModuleSchema,
  updateTrainingPlanSchema,
  updateTrainingSectionSchema,
  viewMarkSchema,
  wheelStampBodySchema,
  wheelStampResultSchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

// ---------- Coordinación: entradas ----------
export class CreateTrainingPlanDto extends createZodDto(createTrainingPlanSchema) {}
export class UpdateTrainingPlanDto extends createZodDto(updateTrainingPlanSchema) {}
export class CreateTrainingSectionDto extends createZodDto(createTrainingSectionSchema) {}
export class UpdateTrainingSectionDto extends createZodDto(updateTrainingSectionSchema) {}
export class CreateTrainingModuleDto extends createZodDto(createTrainingModuleSchema) {}
export class UpdateTrainingModuleDto extends createZodDto(updateTrainingModuleSchema) {}
export class RequestModuleFileUploadDto extends createZodDto(requestModuleFileUploadSchema) {}
export class ModuleFileParamsDto extends createZodDto(moduleFileParamsSchema) {}
export class ConfirmModuleFileParamsDto extends createZodDto(confirmModuleFileParamsSchema) {}
export class CertificateListQueryDto extends createZodDto(certificateListQuerySchema) {}
export class CertificateCodeParamDto extends createZodDto(certificateCodeParamSchema) {}
export class TrackingPlanParamsDto extends createZodDto(trackingPlanParamsSchema) {}
export class TrackingTeacherParamsDto extends createZodDto(trackingTeacherParamsSchema) {}
export class OrderDto extends createZodDto(orderSchema) {}
export class CreateSlideDto extends createZodDto(createSlideSchema) {}
export class UpdateSlideDto extends createZodDto(updateSlideSchema) {}
export class CreateActivityDto extends createZodDto(createActivitySchema) {}
export class UpdateActivityDto extends createZodDto(updateActivitySchema) {}
export class SlideParamsDto extends createZodDto(slideParamsSchema) {}
export class QuestionParamsDto extends createZodDto(questionParamsSchema) {}
export class ActivityParamsDto extends createZodDto(activityParamsSchema) {}

// ---------- Coordinación: respuestas ----------
const codec = { codec: true } as const;
export class TrainingPlanDto extends createZodDto(trainingPlanSchema, codec) {}
export class TrainingPlanListDto extends createZodDto(trainingPlanListSchema, codec) {}
export class TrainingPlanTreeDto extends createZodDto(trainingPlanTreeSchema, codec) {}
export class TrainingSectionDto extends createZodDto(trainingSectionSchema, codec) {}
export class TrainingSectionWithModulesDto extends createZodDto(
  trainingSectionWithModulesSchema,
  codec,
) {}
export class TrainingModuleDto extends createZodDto(trainingModuleSchema, codec) {}
export class TrainingModuleDetailDto extends createZodDto(trainingModuleDetailSchema, codec) {}
export class ModuleFileUploadResultDto extends createZodDto(moduleFileUploadResultSchema, codec) {}
export class SignedUrlDto extends createZodDto(signedUrlSchema, codec) {}
export class CertificateListDto extends createZodDto(certificateListSchema, codec) {}
export class CertificateVerificationDto extends createZodDto(
  certificateVerificationSchema,
  codec,
) {}
export class PlanTrackingDto extends createZodDto(planTrackingSchema, codec) {}
export class TeacherTrackingDto extends createZodDto(teacherTrackingSchema, codec) {}
export class SlideDto extends createZodDto(slideSchema, codec) {}
export class ChallengeQuestionDto extends createZodDto(challengeQuestionSchema, codec) {}
export class ActivityDto extends createZodDto(activitySchema, codec) {}

// ---------- Docente ----------
export class TeacherModuleParamsDto extends createZodDto(teacherModuleParamsSchema) {}
export class TeacherModuleFileParamsDto extends createZodDto(teacherModuleFileParamsSchema) {}
export class TeacherActivityParamsDto extends createZodDto(teacherActivityParamsSchema) {}
export class TeacherRouteDto extends createZodDto(teacherRouteSchema, codec) {}
export class TeacherModuleDto extends createZodDto(teacherModuleSchema, codec) {}
export class ViewMarkDto extends createZodDto(viewMarkSchema, codec) {}
export class SimulatorUseBodyDto extends createZodDto(simulatorUseBodySchema) {}
export class SimulatorUseResultDto extends createZodDto(simulatorUseResultSchema, codec) {}
export class WheelStampBodyDto extends createZodDto(wheelStampBodySchema) {}
export class WheelStampResultDto extends createZodDto(wheelStampResultSchema, codec) {}
export class ChallengeStepDto extends createZodDto(challengeStepSchema) {}
export class ChallengeAnswerBodyDto extends createZodDto(challengeAnswerBodySchema) {}
export class ChallengeAnswerResultDto extends createZodDto(challengeAnswerResultSchema, codec) {}
// Las uniones no pueden ser clase base: se exponen como DTO valor para `@ZodResponse`.
export const ActivityGameStepDto = createZodDto(activityGameStepSchema, codec);
export const ActivityGameAnswerResultDto = createZodDto(activityGameAnswerResultSchema, codec);
