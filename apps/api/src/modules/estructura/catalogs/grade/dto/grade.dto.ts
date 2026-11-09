import {
  createGradeSchema,
  createPageSchema,
  gradeListQuerySchema,
  gradeSchema,
  updateGradeSchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

export class GradeDto extends createZodDto(gradeSchema, { codec: true }) {}
export class GradePageDto extends createZodDto(createPageSchema(gradeSchema), { codec: true }) {}
export class GradeListQueryDto extends createZodDto(gradeListQuerySchema) {}
export class CreateGradeDto extends createZodDto(createGradeSchema) {}
export class UpdateGradeDto extends createZodDto(updateGradeSchema) {}
