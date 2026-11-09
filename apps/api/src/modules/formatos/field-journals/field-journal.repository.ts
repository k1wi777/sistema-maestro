import type {
  FieldJournal,
  FieldJournalFilters,
  FieldJournalSortField,
  FieldJournalSummary,
  JournalEventType,
  ListQuery,
  Page,
  RecordStatus,
} from '@gns/shared';

/**
 * Contenido de una entrada como se guarda: `students` es la lista ya unida (`joinStudents`).
 * `undefined` no se toca; `null` vacía un campo opcional.
 */
export interface JournalEntryContent {
  date?: string;
  lesson?: string;
  eventType?: JournalEventType;
  students?: string | null;
  description?: string;
  actions?: string | null;
  reflection?: string | null;
}

export interface NewJournalEntry extends JournalEntryContent {
  date: string;
  lesson: string;
  eventType: JournalEventType;
  description: string;
}

export interface NewFieldJournal {
  teacherId: string;
  gradeId: string;
  periodId: string;
}

export interface FieldJournalChanges {
  status?: RecordStatus;
  submittedAt?: Date | null;
}

/** Fila de la hoja con sus entradas, sin relaciones: lo que se registra en la bitácora. */
export type FieldJournalRecord = {
  id: string;
  teacherId: string;
  gradeId: string;
  periodId: string;
  status: RecordStatus;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  entries: {
    id: string;
    date: string;
    lesson: string | null;
    eventType: string;
    studentNames: string | null;
    description: string;
    actions: string | null;
    reflection: string | null;
  }[];
};

export interface FieldJournalRepository {
  /** Detalle con las entradas ordenadas por fecha, creación e id. */
  findById(id: string): Promise<FieldJournal | null>;
  /** Listado sin entradas pero con `entryCount`. */
  findPage(
    query: ListQuery<FieldJournalFilters, FieldJournalSortField>,
  ): Promise<Page<FieldJournalSummary>>;
  findRecordById(id: string): Promise<FieldJournalRecord | null>;
  /** La hoja del docente para el grado y periodo, en cualquier estado. */
  findByKey(
    teacherId: string,
    gradeId: string,
    periodId: string,
  ): Promise<{ id: string; status: RecordStatus } | null>;
  create(input: NewFieldJournal): Promise<FieldJournal>;
  /** UPDATE condicionado al estado de origen: `false` si otra petición ya movió la hoja. */
  updateIfStatus(
    id: string,
    from: readonly RecordStatus[],
    changes: FieldJournalChanges,
  ): Promise<boolean>;
  /** Bloquea la fila hasta el fin de la transacción para serializar decisiones y escrituras de entradas. */
  lock(id: string): Promise<void>;
  countEntries(journalId: string): Promise<number>;
  addEntry(journalId: string, entry: NewJournalEntry): Promise<void>;
  /** `false` si la entrada no pertenece a la hoja. */
  updateEntry(journalId: string, entryId: string, content: JournalEntryContent): Promise<boolean>;
  /** Borrado físico de la entrada (contenido del borrador); `false` si no pertenece a la hoja. */
  removeEntry(journalId: string, entryId: string): Promise<boolean>;
  /** Refleja en `actualizado_en` de la hoja la actividad de sus entradas. */
  touch(journalId: string): Promise<void>;
}

export const FIELD_JOURNAL_REPOSITORY = Symbol('FIELD_JOURNAL_REPOSITORY');
