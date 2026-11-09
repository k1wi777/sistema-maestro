import {
  createPageSchema,
  createSharedActivitySchema,
  sharedActivityListQuerySchema,
  sharedActivitySchema,
  updateSharedActivitySchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

export class SharedActivityDto extends createZodDto(sharedActivitySchema, { codec: true }) {}
export class SharedActivityPageDto extends createZodDto(createPageSchema(sharedActivitySchema), {
  codec: true,
}) {}
export class SharedActivityListQueryDto extends createZodDto(sharedActivityListQuerySchema) {}
export class CreateSharedActivityDto extends createZodDto(createSharedActivitySchema) {}
export class UpdateSharedActivityDto extends createZodDto(updateSharedActivitySchema) {}
