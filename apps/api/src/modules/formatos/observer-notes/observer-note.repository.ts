import type {
  ObserverNote,
  ObserverNoteFilters,
  ObserverNoteSortField,
  ObserverNoteType,
  RecordStatus,
} from '@gns/shared';
import type { ReadRepository } from '../../../shared/repository/repository';

/** Filtros del repository: el periodo ya se tradujo a las fechas que lo delimitan. */
export type ObserverNoteQueryFilters = Omit<ObserverNoteFilters, 'periodId'> & {
  dateFrom?: string;
  dateTo?: string;
};

/** Campos de contenido; `undefined` no se toca y `null` vacía un opcional. */
export interface ObserverNoteContent {
  studentFirstName?: string;
  date?: string;
  type?: ObserverNoteType;
  description?: string;
  studentVersion?: string | null;
  actions?: string | null;
  familyInformed?: boolean;
  followUp?: string | null;
}

export interface NewObserverNote extends ObserverNoteContent {
  teacherId: string;
  gradeId: string;
  studentFirstName: string;
  date: string;
  type: ObserverNoteType;
  description: string;
}

export interface ObserverNoteChanges extends ObserverNoteContent {
  status?: RecordStatus;
}

/** Fila de la anotación sin relaciones: lo que se registra en la bitácora. */
export type ObserverNoteRecord = {
  id: string;
  teacherId: string;
  gradeId: string;
  studentFirstName: string;
  date: string;
  type: string;
  description: string;
  studentVersion: string | null;
  actions: string | null;
  familyInformed: boolean;
  followUp: string | null;
  status: RecordStatus;
  createdAt: Date;
  updatedAt: Date;
};

export interface ObserverNoteRepository extends ReadRepository<
  ObserverNote,
  ObserverNoteQueryFilters,
  ObserverNoteSortField
> {
  findRecordById(id: string): Promise<ObserverNoteRecord | null>;
  create(input: NewObserverNote): Promise<ObserverNote>;
  /** UPDATE condicionado al estado de origen: `false` si otra petición ya la movió. */
  updateIfStatus(
    id: string,
    from: readonly RecordStatus[],
    changes: ObserverNoteChanges,
  ): Promise<boolean>;
  /** Bloquea la fila hasta el fin de la transacción para serializar decisiones y envíos. */
  lock(id: string): Promise<void>;
}

export const OBSERVER_NOTE_REPOSITORY = Symbol('OBSERVER_NOTE_REPOSITORY');
