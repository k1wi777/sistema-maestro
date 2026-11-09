import {
  approveObserverNoteSchema,
  createObserverNoteSchema,
  observerNoteListQuerySchema,
  observerNotePageSchema,
  observerNoteSchema,
  returnObserverNoteSchema,
  reviewSchema,
  updateObserverNoteSchema,
  voidRecordSchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class ObserverNoteDto extends createZodDto(observerNoteSchema, { codec: true }) {}
export class ObserverNotePageDto extends createZodDto(observerNotePageSchema, { codec: true }) {}
export class ObserverNoteListQueryDto extends createZodDto(observerNoteListQuerySchema) {}
export class CreateObserverNoteDto extends createZodDto(createObserverNoteSchema) {}
export class UpdateObserverNoteDto extends createZodDto(updateObserverNoteSchema) {}
export class VoidObserverNoteDto extends createZodDto(voidRecordSchema) {}
export class ApproveObserverNoteDto extends createZodDto(approveObserverNoteSchema) {}
export class ReturnObserverNoteDto extends createZodDto(returnObserverNoteSchema) {}
export class ObserverNoteReviewListDto extends createZodDto(z.array(reviewSchema), {
  codec: true,
}) {}
