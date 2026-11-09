import {
  createLevelSchema,
  createPageSchema,
  levelListQuerySchema,
  levelSchema,
  updateLevelSchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

export class LevelDto extends createZodDto(levelSchema, { codec: true }) {}
export class LevelPageDto extends createZodDto(createPageSchema(levelSchema), { codec: true }) {}
export class LevelListQueryDto extends createZodDto(levelListQuerySchema) {}
export class CreateLevelDto extends createZodDto(createLevelSchema) {}
export class UpdateLevelDto extends createZodDto(updateLevelSchema) {}
