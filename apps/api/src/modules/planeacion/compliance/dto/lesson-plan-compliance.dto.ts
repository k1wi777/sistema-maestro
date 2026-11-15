import { lessonPlanComplianceQuerySchema, lessonPlanComplianceSchema } from '@gns/shared';
import { createZodDto } from '../../../../shared/http/zod-dto';

export class LessonPlanComplianceDto extends createZodDto(lessonPlanComplianceSchema) {}
export class LessonPlanComplianceQueryDto extends createZodDto(lessonPlanComplianceQuerySchema) {}
