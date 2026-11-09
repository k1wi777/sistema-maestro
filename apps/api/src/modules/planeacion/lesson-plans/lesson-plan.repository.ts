import type {
  LessonPlan,
  LessonPlanAdjustableField,
  LessonPlanFilters,
  LessonPlanSortField,
  RecordStatus,
} from '@gns/shared';
import type { ReadRepository } from '../../../shared/repository/repository';

/** Campos de contenido: fechas como `AAAA-MM-DD`, el resto texto; `null` vacía el campo. */
export type LessonPlanContent = Partial<Record<LessonPlanAdjustableField, string | null>>;

export interface NewLessonPlan extends LessonPlanContent {
  teacherId: string;
  gradeId: string;
  areaId: string;
  periodId: string;
  crossCuttingProject: string | null;
}

export interface LessonPlanChanges extends LessonPlanContent {
  periodId?: string;
  crossCuttingProject?: string | null;
  status?: RecordStatus;
  submittedAt?: Date | null;
}

/** Fila de la planeación sin relaciones: lo que se registra en la bitácora. */
export type LessonPlanRecord = Record<LessonPlanAdjustableField, string | null> & {
  id: string;
  teacherId: string;
  gradeId: string;
  areaId: string;
  periodId: string;
  crossCuttingProject: string | null;
  status: RecordStatus;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface DeliveredFilters {
  schoolYear: string;
  /** Estados que cuentan como entregada. */
  statuses: readonly RecordStatus[];
  teacherId?: string;
  periodId?: string;
}

/** Planeaciones entregadas de un docente en un grado, área y periodo. */
export interface DeliveredCount {
  teacherId: string;
  gradeId: string;
  areaId: string;
  periodId: string;
  count: number;
}

export interface LessonPlanRepository extends ReadRepository<
  LessonPlan,
  LessonPlanFilters,
  LessonPlanSortField
> {
  findRecordById(id: string): Promise<LessonPlanRecord | null>;
  create(input: NewLessonPlan): Promise<LessonPlan>;
  /**
   * UPDATE condicionado al estado de origen: devuelve `false` si la planeación ya no está en
   * alguno de `from` (otra petición la movió antes), sin modificar nada.
   */
  updateIfStatus(
    id: string,
    from: readonly RecordStatus[],
    changes: LessonPlanChanges,
  ): Promise<boolean>;
  /** Bloquea la fila hasta el fin de la transacción para serializar decisiones y altas de enlaces. */
  lock(id: string): Promise<void>;
  /** Una sola consulta agrupada por docente, grado, área y periodo del año (cumplimiento). */
  countDelivered(filters: DeliveredFilters): Promise<DeliveredCount[]>;
}

export const LESSON_PLAN_REPOSITORY = Symbol('LESSON_PLAN_REPOSITORY');
