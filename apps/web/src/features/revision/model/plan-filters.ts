import { RecordStatus } from '@gns/shared';

/** Filtros de la bandeja de planeaciones; viven en la URL. */
export interface PlanFilters {
  status?: RecordStatus;
  gradeId?: string;
  areaId?: string;
  periodId?: string;
  teacherId?: string;
  /** Filtro de administración: coordinadora del grado (UUID) o `none` (sin coordinadora). */
  coordinatorId?: string;
}

/** Estados de la franja de indicadores, en el orden en que se muestran. */
export const INDICATOR_STATUSES: readonly RecordStatus[] = [
  RecordStatus.Submitted,
  RecordStatus.ChangesRequested,
  RecordStatus.Reviewed,
  RecordStatus.Draft,
];

const STATUSES: readonly string[] = Object.values(RecordStatus);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const asId = (value: string | null): string | undefined =>
  value !== null && UUID.test(value) ? value : undefined;

const asCoordinator = (value: string | null): string | undefined =>
  value === 'none' ? value : asId(value);

/** Lee los filtros de la URL; un valor que no es un estado o un id válido se ignora. */
export function planFiltersFromParams(params: {
  get: (name: string) => string | null;
}): PlanFilters {
  const status = params.get('status');
  return {
    status: status !== null && STATUSES.includes(status) ? (status as RecordStatus) : undefined,
    gradeId: asId(params.get('gradeId')),
    areaId: asId(params.get('areaId')),
    periodId: asId(params.get('periodId')),
    teacherId: asId(params.get('teacherId')),
    coordinatorId: asCoordinator(params.get('coordinatorId')),
  };
}

/** Los filtros sin el estado: los indicadores cuentan cada estado con el resto de filtros activos. */
export function withoutStatus(filters: PlanFilters): PlanFilters {
  return { ...filters, status: undefined };
}

/** Clave estable de los filtros, para reiniciar la lista y los indicadores al cambiar. */
export function planFiltersKey(filters: PlanFilters): string {
  return JSON.stringify([
    filters.status,
    filters.gradeId,
    filters.areaId,
    filters.periodId,
    filters.teacherId,
    filters.coordinatorId,
  ]);
}

/** Hay algún filtro activo (estado incluido), para decir «sin resultados» en vez de «vacío». */
export function hasActiveFilters(filters: PlanFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined);
}

/** Query string con los filtros activos («status=enviada&gradeId=…»); vacío sin filtros. */
export function planFiltersToQuery(filters: PlanFilters): string {
  const query = new URLSearchParams();
  const entries: [string, string | undefined][] = [
    ['status', filters.status],
    ['gradeId', filters.gradeId],
    ['areaId', filters.areaId],
    ['periodId', filters.periodId],
    ['teacherId', filters.teacherId],
    ['coordinatorId', filters.coordinatorId],
  ];
  for (const [key, value] of entries) {
    if (value) {
      query.set(key, value);
    }
  }
  return query.toString();
}
