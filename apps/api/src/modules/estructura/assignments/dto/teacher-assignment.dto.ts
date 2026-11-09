import {
  createPageSchema,
  createTeacherAssignmentSchema,
  myAssignmentsSchema,
  teacherAssignmentListQuerySchema,
  teacherAssignmentSchema,
  updateTeacherAssignmentSchema,
  updateTeacherAssignmentStatusSchema,
} from '@gns/shared';
import { createZodDto } from 'nestjs-zod';

export class TeacherAssignmentDto extends createZodDto(teacherAssignmentSchema, { codec: true }) {}
export class TeacherAssignmentPageDto extends createZodDto(
  createPageSchema(teacherAssignmentSchema),
  { codec: true },
) {}
export class TeacherAssignmentListQueryDto extends createZodDto(teacherAssignmentListQuerySchema) {}
export class CreateTeacherAssignmentDto extends createZodDto(createTeacherAssignmentSchema) {}
export class UpdateTeacherAssignmentDto extends createZodDto(updateTeacherAssignmentSchema) {}
export class UpdateTeacherAssignmentStatusDto extends createZodDto(
  updateTeacherAssignmentStatusSchema,
) {}
export class MyAssignmentsDto extends createZodDto(myAssignmentsSchema) {}
