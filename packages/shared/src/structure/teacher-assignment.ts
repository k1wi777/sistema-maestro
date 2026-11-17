import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { AreaType } from '../constants/area';
import { TeacherAssignmentStatus } from '../constants/teacher-assignment';
import { UserStatus } from '../constants/user';
import { createListQuerySchema } from '../list-query/list-query';
import { schoolYearSchema } from './school-year';

const uuid = z.uuid({ error: 'debe ser un UUID' });

const statusSchema = z.enum(
  Object.values(TeacherAssignmentStatus) as [TeacherAssignmentStatus, ...TeacherAssignmentStatus[]],
  { error: 'estado no permitido' },
);
const areaTypeSchema = z.enum(Object.values(AreaType) as [AreaType, ...AreaType[]]);

/** Asignación con los datos anidados que la pantalla de coordinación necesita; nunca incluye el correo. */
export const teacherAssignmentSchema = z.object({
  id: z.uuid(),
  schoolYear: z.string(),
  status: statusSchema,
  isHomeroomTeacher: z.boolean(),
  teacher: z.object({
    id: z.uuid(),
    fullName: z.string(),
    status: z.enum(Object.values(UserStatus) as [UserStatus, ...UserStatus[]]),
  }),
  group: z.object({ id: z.uuid(), name: z.string() }),
  grade: z.object({ id: z.uuid(), name: z.string(), sortOrder: z.number().int() }),
  level: z.object({ id: z.uuid(), name: z.string() }),
  area: z.object({ id: z.uuid(), name: z.string(), type: areaTypeSchema }),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type TeacherAssignment = z.output<typeof teacherAssignmentSchema>;

export const createTeacherAssignmentSchema = z
  .object({
    teacherId: uuid,
    groupId: uuid,
    areaId: uuid,
    isHomeroomTeacher: z.boolean({ error: 'debe ser verdadero o falso' }).default(false),
    schoolYear: schoolYearSchema.optional(),
  })
  .strict();
export type CreateTeacherAssignmentInput = z.output<typeof createTeacherAssignmentSchema>;

/** Cambiar docente, grupo, área o año es retirar y crear otra asignación. */
export const updateTeacherAssignmentSchema = z
  .object({ isHomeroomTeacher: z.boolean({ error: 'debe ser verdadero o falso' }) })
  .strict();
export type UpdateTeacherAssignmentInput = z.output<typeof updateTeacherAssignmentSchema>;

export const updateTeacherAssignmentStatusSchema = z.object({ status: statusSchema }).strict();
export type UpdateTeacherAssignmentStatusInput = z.output<
  typeof updateTeacherAssignmentStatusSchema
>;

export const TEACHER_ASSIGNMENT_SORT_FIELDS = ['createdAt', 'schoolYear'] as const;
export type TeacherAssignmentSortField = (typeof TEACHER_ASSIGNMENT_SORT_FIELDS)[number];
export const teacherAssignmentListQuerySchema = createListQuerySchema({
  sortFields: TEACHER_ASSIGNMENT_SORT_FIELDS,
  defaultSort: { field: 'createdAt', order: 'desc' },
  filters: {
    schoolYear: schoolYearSchema.optional(),
    teacherId: uuid.optional(),
    gradeId: uuid.optional(),
    groupId: uuid.optional(),
    areaId: uuid.optional(),
    status: statusSchema.optional(),
  },
});
export interface TeacherAssignmentFilters {
  schoolYear?: string;
  teacherId?: string;
  gradeId?: string;
  groupId?: string;
  areaId?: string;
  status?: TeacherAssignmentStatus;
}

/**
 * «Mis asignaciones»: año vigente y asignaciones activas agrupadas por grado. Un área que el
 * docente tiene en varios grupos del mismo grado aparece una sola vez.
 */
export const myAssignmentsSchema = z.object({
  schoolYear: z.string(),
  grades: z.array(
    z.object({
      grade: z.object({ id: z.uuid(), name: z.string(), sortOrder: z.number().int() }),
      level: z.object({ id: z.uuid(), name: z.string() }),
      isHomeroomTeacher: z.boolean(),
      groups: z.array(z.object({ id: z.uuid(), name: z.string(), isHomeroomTeacher: z.boolean() })),
      areas: z.array(
        z.object({
          id: z.uuid(),
          name: z.string(),
          type: areaTypeSchema,
        }),
      ),
    }),
  ),
});
export type MyAssignments = z.output<typeof myAssignmentsSchema>;
