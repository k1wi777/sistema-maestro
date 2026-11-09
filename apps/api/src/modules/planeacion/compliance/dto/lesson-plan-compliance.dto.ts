import { lessonPlanComplianceQuerySchema, lessonPlanComplianceSchema } from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

export class LessonPlanComplianceDto extends createZodDto(lessonPlanComplianceSchema) {}
export class LessonPlanComplianceQueryDto extends createZodDto(lessonPlanComplianceQuerySchema) {}
