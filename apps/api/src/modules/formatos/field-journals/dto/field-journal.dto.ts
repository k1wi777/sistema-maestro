import {
  annotationParamSchema,
  approveJournalSchema,
  createAnnotationSchema,
  fieldJournalDayQuerySchema,
  fieldJournalDaySchema,
  fieldJournalListQuerySchema,
  fieldJournalPageSchema,
  fieldJournalSchema,
  journalReviewScopeSchema,
  returnJournalSchema,
  todayJournalsSchema,
  updateAnnotationSchema,
  voidJournalSchema,
} from '@gns/shared';
import { createZodDto } from '../../../../shared/http/zod-dto';

export class FieldJournalDto extends createZodDto(fieldJournalSchema, { codec: true }) {}
export class FieldJournalDayDto extends createZodDto(fieldJournalDaySchema, { codec: true }) {}
export class FieldJournalDayQueryDto extends createZodDto(fieldJournalDayQuerySchema) {}
export class FieldJournalPageDto extends createZodDto(fieldJournalPageSchema, { codec: true }) {}
export class FieldJournalListQueryDto extends createZodDto(fieldJournalListQuerySchema) {}
export class TodayJournalsDto extends createZodDto(todayJournalsSchema, { codec: true }) {}
export class JournalReviewScopeDto extends createZodDto(journalReviewScopeSchema) {}
export class CreateAnnotationDto extends createZodDto(createAnnotationSchema) {}
export class UpdateAnnotationDto extends createZodDto(updateAnnotationSchema) {}
export class AnnotationParamDto extends createZodDto(annotationParamSchema) {}
export class VoidFieldJournalDto extends createZodDto(voidJournalSchema) {}
export class ApproveFieldJournalDto extends createZodDto(approveJournalSchema) {}
export class ReturnFieldJournalDto extends createZodDto(returnJournalSchema) {}
