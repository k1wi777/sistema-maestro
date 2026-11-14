import { z } from 'zod';
import { isoDateTimeSchema } from '../api/iso-date-time';
import { TrackingModuleState } from '../constants/training';
import { certificateSummarySchema } from './certificates';

/**
 * Seguimiento de la formación para coordinación. Solo datos de docentes (nombre, estado, fechas
 * y puntajes): nunca correos, datos de estudiantes, URL firmadas ni claves de objeto.
 */

const states = Object.values(TrackingModuleState) as [
  TrackingModuleState,
  ...TrackingModuleState[],
];
const nullableDate = isoDateTimeSchema.nullable();

export const trackingPlanParamsSchema = z.object({ planId: z.uuid({ error: 'debe ser un UUID' }) });
export const trackingTeacherParamsSchema = z.object({
  teacherId: z.uuid({ error: 'debe ser un UUID' }),
});

// ---------- Por plan ----------

export const trackingModuleSchema = z.strictObject({
  id: z.uuid(),
  number: z.string().nullable(),
  title: z.string(),
  sectionTitle: z.string(),
  totals: z.strictObject({
    notStarted: z.number().int(),
    inProgress: z.number().int(),
    done: z.number().int(),
  }),
});
export type TrackingModule = z.output<typeof trackingModuleSchema>;

export const trackingCellSchema = z.strictObject({
  moduleId: z.uuid(),
  state: z.enum(states),
  completedAt: nullableDate,
  /** Mejor puntaje del Desafío GNS (porcentaje). */
  bestScore: z.number().int().nullable(),
});
export type TrackingCell = z.output<typeof trackingCellSchema>;

export const planTrackingSchema = z.strictObject({
  plan: z.strictObject({
    id: z.uuid(),
    name: z.string(),
    areaId: z.uuid().nullable(),
    areaName: z.string().nullable(),
    schoolYear: z.string().nullable(),
  }),
  modules: z.array(trackingModuleSchema),
  teachers: z.array(
    z.strictObject({
      id: z.uuid(),
      name: z.string(),
      modules: z.array(trackingCellSchema),
    }),
  ),
});
export type PlanTracking = z.output<typeof planTrackingSchema>;

// ---------- Por docente ----------

export const teacherTrackingSchema = z.strictObject({
  teacher: z.strictObject({ id: z.uuid(), name: z.string() }),
  schoolYear: z.string(),
  plans: z.array(
    z.strictObject({
      id: z.uuid(),
      name: z.string(),
      areaName: z.string().nullable(),
      modules: z.array(
        z.strictObject({
          id: z.uuid(),
          number: z.string().nullable(),
          title: z.string(),
          sectionTitle: z.string(),
          state: z.enum(states),
          completedAt: nullableDate,
          bestScore: z.number().int().nullable(),
        }),
      ),
    }),
  ),
  certificates: z.array(certificateSummarySchema),
});
export type TeacherTracking = z.output<typeof teacherTrackingSchema>;
