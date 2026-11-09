import {
  createLessonPlanResourceSchema,
  lessonPlanResourceParamsSchema,
  lessonPlanResourceSchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

export class LessonPlanResourceDto extends createZodDto(lessonPlanResourceSchema, {
  codec: true,
}) {}
export class CreateLessonPlanResourceDto extends createZodDto(createLessonPlanResourceSchema) {}
export class LessonPlanResourceParamsDto extends createZodDto(lessonPlanResourceParamsSchema) {}
