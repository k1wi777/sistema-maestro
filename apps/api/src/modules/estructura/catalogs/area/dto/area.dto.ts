import {
  areaListQuerySchema,
  areaSchema,
  createAreaSchema,
  createPageSchema,
  updateAreaSchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

export class AreaDto extends createZodDto(areaSchema, { codec: true }) {}
export class AreaPageDto extends createZodDto(createPageSchema(areaSchema), { codec: true }) {}
export class AreaListQueryDto extends createZodDto(areaListQuerySchema) {}
export class CreateAreaDto extends createZodDto(createAreaSchema) {}
export class UpdateAreaDto extends createZodDto(updateAreaSchema) {}
