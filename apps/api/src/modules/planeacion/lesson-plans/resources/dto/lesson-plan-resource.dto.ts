import {
  createLessonPlanResourceSchema,
  lessonPlanResourceParamsSchema,
  lessonPlanResourceSchema,
} from '@gns/shared';
import { createZodDto } from '../../../../../shared/http/zod-dto';

export class LessonPlanResourceDto extends createZodDto(lessonPlanResourceSchema, {
  codec: true,
}) {}
export class CreateLessonPlanResourceDto extends createZodDto(createLessonPlanResourceSchema) {}
export class LessonPlanResourceParamsDto extends createZodDto(lessonPlanResourceParamsSchema) {}
