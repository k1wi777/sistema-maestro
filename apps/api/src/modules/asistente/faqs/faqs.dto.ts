import {
  assistantAnswerSchema,
  assistantQuerySchema,
  createFaqSchema,
  createPageSchema,
  faqAdminViewSchema,
  faqListQuerySchema,
  faqListSchema,
  updateFaqSchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateFaqDto extends createZodDto(createFaqSchema) {}
export class UpdateFaqDto extends createZodDto(updateFaqSchema) {}
export class FaqListQueryDto extends createZodDto(faqListQuerySchema) {}
export class FaqListDto extends createZodDto(faqListSchema) {}
export class FaqAdminDto extends createZodDto(faqAdminViewSchema, { codec: true }) {}
export class FaqAdminPageDto extends createZodDto(createPageSchema(faqAdminViewSchema), {
  codec: true,
}) {}
export class AssistantQueryDto extends createZodDto(assistantQuerySchema) {}
// Las uniones no pueden ser clase base: se exponen como DTO valor para `@ZodResponse`.
export const AssistantAnswerDto = createZodDto(assistantAnswerSchema);
