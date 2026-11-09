import {
  createPageSchema,
  createSchoolYearSchema,
  schoolYearEntitySchema,
  schoolYearListQuerySchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

export class SchoolYearDto extends createZodDto(schoolYearEntitySchema, { codec: true }) {}
export class SchoolYearPageDto extends createZodDto(createPageSchema(schoolYearEntitySchema), {
  codec: true,
}) {}
export class SchoolYearListQueryDto extends createZodDto(schoolYearListQuerySchema) {}
export class CreateSchoolYearDto extends createZodDto(createSchoolYearSchema) {}
