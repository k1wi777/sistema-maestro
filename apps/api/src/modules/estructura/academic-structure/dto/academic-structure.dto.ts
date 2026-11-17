import {
  academicStructureSchema,
  coordinatorGradesSchema,
  setCoordinatorGradesSchema,
} from '@gns/shared';
import { createZodDto } from '../../../../shared/http/zod-dto';

export class AcademicStructureDto extends createZodDto(academicStructureSchema) {}
export class CoordinatorGradesDto extends createZodDto(coordinatorGradesSchema) {}
export class SetCoordinatorGradesDto extends createZodDto(setCoordinatorGradesSchema) {}
