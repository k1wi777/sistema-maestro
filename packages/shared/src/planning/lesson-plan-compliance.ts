import { z } from 'zod';
import { ComplianceStatus } from '../constants/planning';

const uuid = z.uuid({ error: 'debe ser un UUID' });

/** Query del cumplimiento: estricta y con filtros opcionales por periodo y docente. */
export const lessonPlanComplianceQuerySchema = z.strictObject({
  periodId: uuid.optional(),
  teacherId: uuid.optional(),
});
export type LessonPlanComplianceQuery = z.output<typeof lessonPlanComplianceQuerySchema>;

const reference = z.object({ id: z.uuid(), name: z.string() });

export const complianceItemSchema = z.object({
  grade: reference,
  level: reference,
  area: reference,
  period: z.object({ id: z.uuid(), number: z.number().int() }),
  status: z.enum(Object.values(ComplianceStatus) as [ComplianceStatus, ...ComplianceStatus[]]),
  deliveredCount: z.number().int(),
});
export type ComplianceItem = z.output<typeof complianceItemSchema>;

export const complianceTeacherSchema = z.object({
  teacher: z.object({ id: z.uuid(), fullName: z.string() }),
  deliveredCount: z.number().int(),
  pendingCount: z.number().int(),
  items: z.array(complianceItemSchema),
});
export type ComplianceTeacher = z.output<typeof complianceTeacherSchema>;

/** Cumplimiento del año vigente: una entrada por docente con asignaciones activas. Sin correos ni datos de estudiantes. */
export const lessonPlanComplianceSchema = z.object({
  schoolYear: z.string(),
  periods: z.array(
    z.object({
      id: z.uuid(),
      number: z.number().int(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
    }),
  ),
  teachers: z.array(complianceTeacherSchema),
});
export type LessonPlanCompliance = z.output<typeof lessonPlanComplianceSchema>;
