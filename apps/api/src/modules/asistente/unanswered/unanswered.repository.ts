import type {
  ListQuery,
  Page,
  UnansweredFilters,
  UnansweredQuestion,
  UnansweredQuestionStatus,
  UnansweredSortField,
} from '@gns/shared';

export interface CloseUnansweredInput {
  status: typeof UnansweredQuestionStatus.Attended | typeof UnansweredQuestionStatus.Discarded;
  closedById: string;
  closedAt: Date;
  /** Solo al atender: la pregunta frecuente creada a partir de esta. */
  faqId: string | null;
}

export interface RecordOccurrenceInput {
  /** Texto tal como lo escribió la persona, recortado y con espacios colapsados. */
  text: string;
  /** Clave de agrupación (sin tildes, mayúsculas ni signos). */
  normalizedText: string;
  userId: string;
  at: Date;
}

export interface UnansweredRepository {
  /** Con todas sus ocurrencias, de la más reciente a la más antigua (R19). */
  findById(id: string): Promise<UnansweredQuestion | null>;
  /** Solo la fila del grupo, sin ocurrencias: lo que lee la bitácora. */
  findGroup(id: string): Promise<UnansweredQuestion | null>;
  /** Con las `UNANSWERED_LIST_OCCURRENCES` más recientes de cada una (R14). */
  findPage(
    query: ListQuery<UnansweredFilters, UnansweredSortField>,
  ): Promise<Page<UnansweredQuestion>>;
  /**
   * Suma una vez a la pendiente con ese texto normalizado o la crea, de forma atómica, y añade la
   * ocurrencia. Devuelve el id del grupo (R13).
   */
  recordOccurrence(input: RecordOccurrenceInput): Promise<string>;
  /**
   * Cierra la pregunta si sigue pendiente y retira su texto, conservando ocurrencias y contadores.
   * `false` si no estaba pendiente o no existe (R15, R16).
   */
  close(id: string, input: CloseUnansweredInput): Promise<boolean>;
}

export const UNANSWERED_REPOSITORY = Symbol('UNANSWERED_REPOSITORY');
