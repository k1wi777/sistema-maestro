import {
  approveFieldJournalSchema,
  createFieldJournalEntrySchema,
  createFieldJournalSchema,
  fieldJournalEntryParamSchema,
  fieldJournalListQuerySchema,
  fieldJournalPageSchema,
  fieldJournalSchema,
  returnFieldJournalSchema,
  reviewSchema,
  updateFieldJournalEntrySchema,
  voidRecordSchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class FieldJournalDto extends createZodDto(fieldJournalSchema, { codec: true }) {}
export class FieldJournalPageDto extends createZodDto(fieldJournalPageSchema, { codec: true }) {}
export class FieldJournalListQueryDto extends createZodDto(fieldJournalListQuerySchema) {}
export class CreateFieldJournalDto extends createZodDto(createFieldJournalSchema) {}
export class CreateFieldJournalEntryDto extends createZodDto(createFieldJournalEntrySchema) {}
export class UpdateFieldJournalEntryDto extends createZodDto(updateFieldJournalEntrySchema) {}
export class FieldJournalEntryParamDto extends createZodDto(fieldJournalEntryParamSchema) {}
export class VoidFieldJournalDto extends createZodDto(voidRecordSchema) {}
export class ApproveFieldJournalDto extends createZodDto(approveFieldJournalSchema) {}
export class ReturnFieldJournalDto extends createZodDto(returnFieldJournalSchema) {}
export class FieldJournalReviewListDto extends createZodDto(z.array(reviewSchema), {
  codec: true,
}) {}
