import {
  approveLessonPlanSchema,
  createLessonPlanSchema,
  createPageSchema,
  lessonPlanListQuerySchema,
  lessonPlanSchema,
  returnLessonPlanSchema,
  reviewSchema,
  updateLessonPlanSchema,
  voidLessonPlanSchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class LessonPlanDto extends createZodDto(lessonPlanSchema, { codec: true }) {}
export class LessonPlanPageDto extends createZodDto(createPageSchema(lessonPlanSchema), {
  codec: true,
}) {}
export class LessonPlanListQueryDto extends createZodDto(lessonPlanListQuerySchema) {}
export class CreateLessonPlanDto extends createZodDto(createLessonPlanSchema) {}
export class UpdateLessonPlanDto extends createZodDto(updateLessonPlanSchema) {}
export class VoidLessonPlanDto extends createZodDto(voidLessonPlanSchema) {}
export class ApproveLessonPlanDto extends createZodDto(approveLessonPlanSchema) {}
export class ReturnLessonPlanDto extends createZodDto(returnLessonPlanSchema) {}
export class ReviewListDto extends createZodDto(z.array(reviewSchema), { codec: true }) {}
