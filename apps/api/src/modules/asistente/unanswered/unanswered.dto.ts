import { createPageSchema, unansweredListQuerySchema, unansweredQuestionSchema } from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

export class UnansweredQuestionDto extends createZodDto(unansweredQuestionSchema, {
  codec: true,
}) {}
export class UnansweredQuestionPageDto extends createZodDto(
  createPageSchema(unansweredQuestionSchema),
  { codec: true },
) {}
export class UnansweredListQueryDto extends createZodDto(unansweredListQuerySchema) {}
