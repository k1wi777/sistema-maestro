import type { CsvValue } from '../../../shared/csv/csv';
import { formatBogotaDateOnly, formatBogotaDateTime } from '../../../shared/time/bogota-time';
import {
  TrackingModuleState,
  type PlanTracking,
  type TrackingCell,
  type TrackingModule,
} from '@gns/shared';

export interface TrackedModule {
  id: string;
  number: string | null;
  title: string;
  sectionTitle: string;
}

export interface TrackedTeacher {
  id: string;
  name: string;
}

/** Fila de `progreso_modulo`: existe desde la primera marca del docente en el módulo. */
export interface TrackedProgress {
  teacherId: string;
  moduleId: string;
  completedAt: Date | null;
  bestScore: number | null;
}

/**
 * `terminado` = `terminado_en` no nulo; `en_curso` = hay fila de progreso sin terminar;
 * `sin_iniciar` = no hay fila.
 */
export function trackingState(progress: TrackedProgress | undefined): TrackingModuleState {
  if (!progress) {
    return TrackingModuleState.NotStarted;
  }
  return progress.completedAt ? TrackingModuleState.Done : TrackingModuleState.InProgress;
}

export function trackingCell(
  moduleId: string,
  progress: TrackedProgress | undefined,
): TrackingCell {
  return {
    moduleId,
    state: trackingState(progress),
    completedAt: progress?.completedAt ?? null,
    bestScore: progress?.bestScore ?? null,
  };
}

const byName = (a: TrackedTeacher, b: TrackedTeacher): number =>
  a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id);

/**
 * Matriz docente × módulo del plan con los totales por estado de cada módulo. Los módulos ya
 * vienen en el orden de sección y módulo; los docentes se ordenan por nombre.
 */
export function summarizePlan(
  plan: PlanTracking['plan'],
  modules: readonly TrackedModule[],
  teachers: readonly TrackedTeacher[],
  progress: readonly TrackedProgress[],
): PlanTracking {
  const byKey = new Map(progress.map((item) => [`${item.teacherId}:${item.moduleId}`, item]));
  const rows = [...teachers].sort(byName).map((teacher) => ({
    id: teacher.id,
    name: teacher.name,
    modules: modules.map((module) =>
      trackingCell(module.id, byKey.get(`${teacher.id}:${module.id}`)),
    ),
  }));
  const trackedModules: TrackingModule[] = modules.map((module, index) => {
    const totals = { notStarted: 0, inProgress: 0, done: 0 };
    for (const row of rows) {
      const state = row.modules[index]?.state;
      if (state === TrackingModuleState.Done) {
        totals.done += 1;
      } else if (state === TrackingModuleState.InProgress) {
        totals.inProgress += 1;
      } else {
        totals.notStarted += 1;
      }
    }
    return { ...module, totals };
  });
  return { plan, modules: trackedModules, teachers: rows };
}

// ---------- Exportación ----------

/** Columnas fijas del CSV (R24). */
export const EXPORT_HEADER = [
  'Plan',
  'Sección',
  'Módulo',
  'Docente',
  'Estado',
  'Fecha de terminación',
  'Mejor puntaje (%)',
  'Certificado',
] as const;

const STATE_LABELS: Record<TrackingModuleState, string> = {
  [TrackingModuleState.NotStarted]: 'Sin iniciar',
  [TrackingModuleState.InProgress]: 'En curso',
  [TrackingModuleState.Done]: 'Terminado',
};

/**
 * Una fila por docente y módulo. Solo datos de docentes: sin correos, códigos de certificado,
 * URL ni claves de objeto (R25); la columna Certificado dice solo `sí` o `no`.
 */
export function exportRows(
  tracking: PlanTracking,
  certificates: ReadonlySet<string>,
): CsvValue[][] {
  const modules = new Map(tracking.modules.map((module) => [module.id, module]));
  return tracking.teachers.flatMap((teacher) =>
    teacher.modules.map((cell) => {
      const module = modules.get(cell.moduleId);
      return [
        tracking.plan.name,
        module?.sectionTitle ?? '',
        module?.number ? `${module.number}. ${module.title}` : (module?.title ?? ''),
        teacher.name,
        STATE_LABELS[cell.state],
        cell.completedAt ? formatBogotaDateTime(cell.completedAt) : '',
        cell.bestScore,
        certificates.has(`${teacher.id}:${cell.moduleId}`) ? 'sí' : 'no',
      ];
    }),
  );
}

/** `seguimiento-<plan>-<aaaa-mm-dd>.csv` con el nombre del plan reducido a ASCII. */
export function exportFileName(planName: string, date: Date): string {
  const slug = planName
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `seguimiento-${slug || 'plan'}-${formatBogotaDateOnly(date)}.csv`;
}
