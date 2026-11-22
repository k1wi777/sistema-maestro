import type {
  AnnotationStatus,
  FieldJournalFilters,
  FieldJournalSortField,
  JournalStatus,
  ListQuery,
  Page,
} from '@gns/shared';

/** Contenido de una anotación como se guarda (clase y descripción); `undefined` no se toca. */
export interface AnnotationContent {
  areaId?: string;
  description?: string;
}

export interface NewAnnotation extends AnnotationContent {
  teacherId: string;
  areaId: string;
  description: string;
}

export interface JournalBase {
  id: string;
  groupId: string;
  /** `AAAA-MM-DD`. */
  date: string;
  schoolYear: string;
  status: JournalStatus;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  voidedAt: Date | null;
  createdBy: { id: string; fullName: string };
  voidedBy: { id: string; fullName: string } | null;
  group: { id: string; name: string };
  grade: { id: string; name: string; coordinatorId: string | null };
  level: { id: string; name: string };
}

export interface AnnotationRow {
  id: string;
  journalId: string;
  teacherId: string;
  teacherName: string;
  areaId: string;
  areaName: string;
  description: string;
  status: AnnotationStatus;
  readyAt: Date | null;
  sent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Aporte de un docente al diario, contado sobre todas sus anotaciones (también borradores). */
export interface ContributionRow {
  teacherId: string;
  teacherName: string;
  /** Anotaciones listas u observadas. */
  ready: number;
  drafts: number;
  firstReadyAt: Date | null;
  /** Áreas de sus anotaciones listas u observadas (por si ya no está en el grupo). */
  areaNames: string[];
}

export interface MissingEntry {
  teacherId: string;
  status: 'borrador' | 'sin_aporte';
}

export interface SubmissionRow {
  id: string;
  directorId: string;
  directorName: string;
  submittedAt: Date;
  resubmission: boolean;
  readyCount: number;
  expectedCount: number;
  missing: MissingEntry[];
}

export interface NewSubmission {
  journalId: string;
  directorId: string;
  submittedAt: Date;
  resubmission: boolean;
  readyCount: number;
  expectedCount: number;
  missing: MissingEntry[];
}

export interface ObservationRow {
  id: string;
  reviewId: string;
  annotationId: string;
  text: string;
  reviewer: { id: string; fullName: string };
  date: Date;
}

export interface JournalChanges {
  status?: JournalStatus;
  submittedAt?: Date;
  voidedAt?: Date;
  voidedById?: string;
}

/** Quién consulta una lista: sus grupos y diarios, o la bandeja de revisión. */
export type JournalVisibility =
  | { kind: 'mine'; userId: string; groupIds: string[] }
  /** `coordinatorId` nulo: administración (todos los diarios, también los En curso). */
  | { kind: 'review'; coordinatorId: string | null };

export type JournalListFilters = FieldJournalFilters & { visibility: JournalVisibility };

/** Diario en un listado: sin anotaciones ni resúmenes (el servicio los completa). */
export interface JournalListItem {
  id: string;
  groupId: string;
  groupName: string;
  gradeId: string;
  gradeName: string;
  date: string;
  schoolYear: string;
  status: JournalStatus;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JournalListExtras {
  /** Docentes con alguna anotación lista u observada. */
  readyTeachers: number;
  lastSubmission: { readyCount: number; expectedCount: number } | null;
  /** Última decisión de coordinación. */
  review: { reviewer: { id: string; fullName: string }; date: Date; approved: boolean } | null;
  /** Anotaciones del usuario que consulta con observación pendiente (Por corregir). */
  myObserved: number;
}

export interface ReviewScope {
  grades: { id: string; name: string }[];
  groups: { id: string; name: string; gradeId: string }[];
}

/** Fila del diario con sus anotaciones y observaciones, sin relaciones: lo que va a la bitácora. */
export type FieldJournalRecord = {
  id: string;
  groupId: string;
  groupName: string;
  date: string;
  schoolYear: string;
  status: JournalStatus;
  createdById: string;
  submittedAt: Date | null;
  voidedAt: Date | null;
  voidedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSubmission: { readyCount: number; expectedCount: number } | null;
  annotations: {
    id: string;
    teacherId: string;
    areaId: string;
    description: string;
    status: string;
    readyAt: Date | null;
    sent: boolean;
  }[];
  observations: { id: string; reviewId: string; annotationId: string; text: string }[];
};

export interface FieldJournalRepository {
  findBase(id: string): Promise<JournalBase | null>;
  findByKey(
    groupId: string,
    date: string,
  ): Promise<{ id: string; status: JournalStatus; schoolYear: string } | null>;
  /**
   * `INSERT … ON CONFLICT (grupo, fecha) DO NOTHING` y después `SELECT … FOR UPDATE`: dos altas
   * simultáneas comparten el diario, que queda bloqueado hasta el fin de la transacción.
   */
  openOrCreate(input: {
    groupId: string;
    date: string;
    schoolYear: string;
    createdById: string;
  }): Promise<{ id: string; status: JournalStatus }>;
  /** Bloquea la fila hasta el fin de la transacción: serializa envío, ediciones y decisiones. */
  lock(id: string): Promise<void>;
  updateJournal(id: string, changes: JournalChanges): Promise<void>;
  /** Refleja en `actualizado_en` del diario la actividad de sus anotaciones. */
  touch(id: string): Promise<void>;

  /** Anotaciones visibles para `viewerId`: las que no son borrador y las propias. */
  findAnnotations(journalId: string, viewerId: string): Promise<AnnotationRow[]>;
  /** Una anotación del diario en cualquier estado (el servicio decide quién la ve). */
  findAnnotation(journalId: string, annotationId: string): Promise<AnnotationRow | null>;
  contributions(journalId: string): Promise<ContributionRow[]>;
  insertAnnotation(journalId: string, annotation: NewAnnotation): Promise<void>;
  updateAnnotation(annotationId: string, content: AnnotationContent): Promise<void>;
  setAnnotationStatus(
    annotationId: string,
    state: { status: AnnotationStatus; readyAt: Date | null },
  ): Promise<void>;
  /** Las anotaciones listas del diario pasan a «enviadas». */
  markReadySent(journalId: string): Promise<void>;
  markObserved(annotationIds: string[]): Promise<void>;

  insertSubmission(submission: NewSubmission): Promise<void>;
  findSubmissions(journalId: string): Promise<SubmissionRow[]>;
  insertObservations(
    reviewId: string,
    observations: { annotationId: string; text: string }[],
  ): Promise<void>;
  findObservations(journalId: string): Promise<ObservationRow[]>;
  findUsers(ids: string[]): Promise<{ id: string; fullName: string }[]>;

  findPage(
    query: ListQuery<JournalListFilters, FieldJournalSortField>,
  ): Promise<Page<JournalListItem>>;
  findListExtras(ids: string[], viewerId: string): Promise<Map<string, JournalListExtras>>;
  findByGroupsAndDate(groupIds: string[], date: string): Promise<JournalListItem[]>;
  countByStatus(visibility: JournalVisibility): Promise<Partial<Record<JournalStatus, number>>>;
  findReviewScope(coordinatorId: string | null): Promise<ReviewScope>;
  findRecordById(id: string): Promise<FieldJournalRecord | null>;
}

export const FIELD_JOURNAL_REPOSITORY = Symbol('FIELD_JOURNAL_REPOSITORY');
