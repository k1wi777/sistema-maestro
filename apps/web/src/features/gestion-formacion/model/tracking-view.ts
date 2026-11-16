import { TrackingModuleState, type PlanTracking, type TrackingCell } from '@gns/shared';

type Teacher = PlanTracking['teachers'][number];
type TrackedModule = PlanTracking['modules'][number];

export interface TrackingIndicators {
  teachers: number;
  /** Celdas terminadas sobre docentes × módulos, en porcentaje entero; `null` sin docentes o sin módulos. */
  overallPercent: number | null;
  /** Docentes con todos los módulos del plan terminados. */
  finishedAll: number;
  /** Media del mejor puntaje del Desafío de las celdas que lo tienen; `null` si ninguna. */
  averageScore: number | null;
  modules: number;
}

function cellOf(teacher: Teacher, moduleId: string): TrackingCell | null {
  return teacher.modules.find((cell) => cell.moduleId === moduleId) ?? null;
}

/** Estado de un docente en un módulo; sin celda cuenta como «sin iniciar». */
export function stateOf(teacher: Teacher, moduleId: string): TrackingModuleState {
  return cellOf(teacher, moduleId)?.state ?? TrackingModuleState.NotStarted;
}

/** Indicadores del plan: docentes, avance general, quienes terminaron todo, promedio y módulos. */
export function trackingIndicators(tracking: PlanTracking): TrackingIndicators {
  const { teachers, modules } = tracking;
  const cells = teachers.length * modules.length;
  let done = 0;
  let finishedAll = 0;
  const scores: number[] = [];
  for (const teacher of teachers) {
    let teacherDone = 0;
    for (const tracked of modules) {
      const cell = cellOf(teacher, tracked.id);
      if (cell?.state === TrackingModuleState.Done) {
        teacherDone += 1;
      }
      if (cell?.bestScore != null) {
        scores.push(cell.bestScore);
      }
    }
    done += teacherDone;
    if (modules.length > 0 && teacherDone === modules.length) {
      finishedAll += 1;
    }
  }
  return {
    teachers: teachers.length,
    overallPercent: cells === 0 ? null : Math.round((done / cells) * 100),
    finishedAll,
    averageScore:
      scores.length === 0
        ? null
        : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    modules: modules.length,
  };
}

/** Minúsculas y sin tildes, para buscar por nombre. */
export function normalizeName(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Docentes cuyo nombre contiene el texto buscado (sin tildes ni mayúsculas). */
export function filterTeachers(teachers: readonly Teacher[], query: string): Teacher[] {
  const needle = normalizeName(query);
  return needle === ''
    ? [...teachers]
    : teachers.filter((teacher) => normalizeName(teacher.name).includes(needle));
}

export interface MatrixRow {
  teacherId: string;
  name: string;
  /** Un estado por módulo, en el orden de `tracking.modules`. */
  states: TrackingModuleState[];
  /** Módulos terminados sobre los del plan, en porcentaje entero. */
  percent: number;
}

export function matrixRows(tracking: PlanTracking, query: string): MatrixRow[] {
  return filterTeachers(tracking.teachers, query).map((teacher) => {
    const states = tracking.modules.map((module) => stateOf(teacher, module.id));
    const done = states.filter((state) => state === TrackingModuleState.Done).length;
    return {
      teacherId: teacher.id,
      name: teacher.name,
      states,
      percent: states.length === 0 ? 0 : Math.round((done / states.length) * 100),
    };
  });
}

/** Cabecera corta de un módulo en la matriz: «M3» para un número y, si no es numérico, el propio texto. */
export function moduleColumnLabel(module: Pick<TrackedModule, 'number'>, index: number): string {
  const number = module.number?.trim() ?? '';
  if (number === '') {
    return `M${index + 1}`;
  }
  return /^\d+$/.test(number) ? `M${number}` : number;
}

export interface ModuleDetailRow {
  teacherId: string;
  name: string;
  state: TrackingModuleState;
  bestScore: number | null;
  completedAt: Date | null;
}

export interface ModuleDetailView {
  module: TrackedModule;
  rows: ModuleDetailRow[];
}

/** Detalle de un módulo del seguimiento: sus totales y, por docente, estado, puntaje y fecha. */
export function moduleDetailView(
  tracking: PlanTracking,
  moduleId: string,
  query: string,
): ModuleDetailView | null {
  const found = tracking.modules.find((item) => item.id === moduleId);
  if (!found) {
    return null;
  }
  return {
    module: found,
    rows: filterTeachers(tracking.teachers, query).map((teacher) => {
      const cell = cellOf(teacher, found.id);
      return {
        teacherId: teacher.id,
        name: teacher.name,
        state: cell?.state ?? TrackingModuleState.NotStarted,
        bestScore: cell?.bestScore ?? null,
        completedAt: cell?.completedAt ?? null,
      };
    }),
  };
}

/** El módulo de la URL solo vale si está en el seguimiento; si no, se ve el plan completo. */
export function validModuleId(tracking: PlanTracking, requested: string | null): string {
  return requested && tracking.modules.some((module) => module.id === requested) ? requested : '';
}
