import {
  academicPeriodListQuerySchema,
  academicPeriodSchema,
  createAcademicPeriodSchema,
  createPageSchema,
  updateAcademicPeriodSchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

export class AcademicPeriodDto extends createZodDto(academicPeriodSchema, { codec: true }) {}
export class AcademicPeriodPageDto extends createZodDto(createPageSchema(academicPeriodSchema), {
  codec: true,
}) {}
export class AcademicPeriodListQueryDto extends createZodDto(academicPeriodListQuerySchema) {}
export class CreateAcademicPeriodDto extends createZodDto(createAcademicPeriodSchema) {}
export class UpdateAcademicPeriodDto extends createZodDto(updateAcademicPeriodSchema) {}
