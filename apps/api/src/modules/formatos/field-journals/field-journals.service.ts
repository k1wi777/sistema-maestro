import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  allowedFrom,
  allowedFromAny,
  canTransition,
  diffFields,
  FIELD_JOURNAL_ENTRY_ADJUSTABLE_FIELDS,
  journalEntryChangeField,
  journalEntryNeedsActions,
  joinStudents,
  JOURNAL_ACTIONS_REQUIRED_REASON,
  RecordActor,
  RecordOperation,
  RecordStatus,
  REVIEW_DECISION_RESULT_STATUS,
  ReviewDecision,
  ReviewRecordType,
  type ApiFieldError,
  type ApproveFieldJournalInput,
  type CreateFieldJournalEntryInput,
  type CreateFieldJournalInput,
  type FieldJournal,
  type FieldJournalEntry,
  type FieldJournalEntryChangeInput,
  type FieldJournalFilters,
  type FieldJournalSortField,
  type FieldJournalSummary,
  type ListQuery,
  type Page,
  type ReturnFieldJournalInput,
  type Review,
  type ReviewFieldChange,
  type UpdateFieldJournalEntryInput,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import { TeacherAssignmentsService } from '../../estructura/assignments/teacher-assignments.service';
import { AcademicPeriodsService } from '../../estructura/catalogs/academic-period/academic-periods.service';
import { ReviewsService } from '../../planeacion/review/reviews.service';
import { actorsOf, isReviewer, STATUS_LABEL, voidConflictMessage } from '../common/record-rules';
import {
  FIELD_JOURNAL_REPOSITORY,
  type FieldJournalRecord,
  type FieldJournalRepository,
  type JournalEntryContent,
} from './field-journal.repository';

const NOT_FOUND = 'Hoja de diario no encontrada';
const ENTRY_NOT_FOUND = 'Registro del diario no encontrado';
const ENTRY_COLUMNS = Object.entries(FIELD_JOURNAL_ENTRY_ADJUSTABLE_FIELDS) as [
  keyof typeof FIELD_JOURNAL_ENTRY_ADJUSTABLE_FIELDS,
  string,
][];
const ENTRY_KEYS = ENTRY_COLUMNS.map(([key]) => key);

/** Contenido listo para guardar: la lista de estudiantes pasa a su forma unida. */
function toStored(input: UpdateFieldJournalEntryInput): JournalEntryContent {
  const stored: JournalEntryContent = {};
  for (const key of ENTRY_KEYS) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    if (key === 'students') {
      stored.students = joinStudents(value as string[]);
    } else {
      (stored as Record<string, unknown>)[key] = value;
    }
  }
  return stored;
}

/** Valores comparables de una entrada leída (estudiantes unidos, como se guardan). */
const storedOf = (entry: FieldJournalEntry): JournalEntryContent => ({
  date: entry.date,
  lesson: entry.lesson ?? undefined,
  eventType: entry.eventType,
  students: joinStudents(entry.students),
  description: entry.description,
  actions: entry.actions,
  reflection: entry.reflection,
});

/** Regla del prototipo sobre el valor resultante: «a mejorar» exige acciones. */
function entryErrors(resulting: JournalEntryContent, prefix = ''): ApiFieldError[] {
  return journalEntryNeedsActions(resulting.eventType, resulting.actions)
    ? [{ field: `${prefix}actions`, reason: JOURNAL_ACTIONS_REQUIRED_REASON }]
    : [];
}

@Injectable()
export class FieldJournalsService {
  constructor(
    @Inject(FIELD_JOURNAL_REPOSITORY) private readonly repository: FieldJournalRepository,
    private readonly assignments: TeacherAssignmentsService,
    private readonly periods: AcademicPeriodsService,
    private readonly reviews: ReviewsService,
  ) {}

  // ---------- Lectura ----------

  /** Un docente ve solo las suyas (su filtro de docente se ignora); coordinación, todas. */
  list(
    user: RequestUser,
    query: ListQuery<FieldJournalFilters, FieldJournalSortField>,
  ): Promise<Page<FieldJournalSummary>> {
    const filters = isReviewer(user) ? query.filters : { ...query.filters, teacherId: user.id };
    return this.repository.findPage({ ...query, filters });
  }

  get(user: RequestUser, id: string): Promise<FieldJournal> {
    return this.loadVisible(user, id);
  }

  async history(user: RequestUser, id: string): Promise<Review[]> {
    await this.loadVisible(user, id);
    return this.reviews.history(ReviewRecordType.FieldJournal, id);
  }

  /** Fila con sus entradas para la bitácora; sin comprobar visibilidad (no sale por la API). */
  findRaw(id: string): Promise<FieldJournalRecord | null> {
    return this.repository.findRecordById(id);
  }

  // ---------- Hoja ----------

  /** Orden: 409 (sin año) → 403 (grado sin asignación) → 400 (periodo) → 409 (duplicada). */
  async create(user: RequestUser, input: CreateFieldJournalInput): Promise<FieldJournal> {
    const mine = await this.assignments.listMine(user.id);
    if (!mine.grades.some((entry) => entry.grade.id === input.gradeId)) {
      throw new ForbiddenException('No tienes una asignación activa en ese grado');
    }
    const period = await this.periods.find(input.periodId);
    if (!period) {
      throw new RequestValidationException([{ field: 'periodId', reason: 'no existe' }]);
    }
    if (period.schoolYear !== mine.schoolYear) {
      throw new RequestValidationException([
        {
          field: 'periodId',
          reason: `debe ser un periodo del año lectivo vigente (${mine.schoolYear})`,
        },
      ]);
    }

    const existing = await this.repository.findByKey(user.id, input.gradeId, input.periodId);
    if (existing) {
      throw new ConflictException(
        existing.status === RecordStatus.Voided
          ? 'Ya tienes una hoja de diario anulada para ese grado y periodo'
          : 'Ya tienes una hoja de diario para ese grado y periodo',
      );
    }
    // Una carrera entre dos altas la resuelve el UNIQUE de la base (409).
    return this.repository.create({ teacherId: user.id, ...input });
  }

  async submit(user: RequestUser, id: string): Promise<FieldJournal> {
    await this.requireOwner(user, id);
    await this.repository.lock(id);
    const journal = await this.loadVisible(user, id);
    const { from, to } = this.transition(RecordOperation.Submit, RecordActor.Owner);
    if (!from.includes(journal.status)) {
      throw new ConflictException(
        `La hoja está ${STATUS_LABEL[journal.status]} y no se puede enviar`,
      );
    }
    if ((await this.repository.countEntries(id)) === 0) {
      throw new RequestValidationException([
        { field: 'entries', reason: 'agrega al menos un registro antes de enviar' },
      ]);
    }
    const updated = await this.repository.updateIfStatus(id, from, {
      status: to ?? RecordStatus.Submitted,
      submittedAt: new Date(),
    });
    if (!updated) {
      await this.failTransition(user, id, 'enviar');
    }
    return this.loadVisible(user, id);
  }

  /** El motivo lo registra la bitácora (`detailFromBody`); aquí solo cambia el estado. */
  async voidJournal(user: RequestUser, id: string): Promise<FieldJournal> {
    const visible = await this.loadVisible(user, id);
    const from = allowedFromAny(RecordOperation.Void, actorsOf(user, visible.teacher.id));
    if (from.length === 0) {
      throw new ForbiddenException('No puedes anular esta hoja');
    }
    await this.repository.lock(id);
    const journal = await this.loadVisible(user, id);
    if (!from.includes(journal.status)) {
      throw new ConflictException(voidConflictMessage('hoja', journal.status));
    }
    if (!(await this.repository.updateIfStatus(id, from, { status: RecordStatus.Voided }))) {
      await this.failTransition(user, id, 'anular');
    }
    return this.loadVisible(user, id);
  }

  // ---------- Entradas (solo el dueño, en borrador u observaciones) ----------

  /** Orden: 404 → 403 → 409 (estado) → 400 (contenido). */
  async addEntry(
    user: RequestUser,
    id: string,
    input: CreateFieldJournalEntryInput,
  ): Promise<FieldJournal> {
    await this.lockEditable(user, id);
    const content = toStored(input);
    this.throwIfInvalid(entryErrors(content));
    await this.repository.addEntry(id, {
      ...content,
      date: input.date,
      lesson: input.lesson,
      eventType: input.eventType,
      description: input.description,
    });
    await this.repository.touch(id);
    return this.loadVisible(user, id);
  }

  async updateEntry(
    user: RequestUser,
    id: string,
    entryId: string,
    input: UpdateFieldJournalEntryInput,
  ): Promise<FieldJournal> {
    const journal = await this.lockEditable(user, id, entryId);
    const entry = journal.entries.find((candidate) => candidate.id === entryId);
    if (!entry) {
      throw new NotFoundException(ENTRY_NOT_FOUND);
    }
    const content = toStored(input);
    this.throwIfInvalid(entryErrors({ ...storedOf(entry), ...content }));
    await this.repository.updateEntry(id, entryId, content);
    await this.repository.touch(id);
    return this.loadVisible(user, id);
  }

  async removeEntry(user: RequestUser, id: string, entryId: string): Promise<FieldJournal> {
    const journal = await this.lockEditable(user, id, entryId);
    if (!journal.entries.some((candidate) => candidate.id === entryId)) {
      throw new NotFoundException(ENTRY_NOT_FOUND);
    }
    await this.repository.removeEntry(id, entryId);
    await this.repository.touch(id);
    return this.loadVisible(user, id);
  }

  // ---------- Revisión de coordinación ----------

  approve(user: RequestUser, id: string, input: ApproveFieldJournalInput): Promise<FieldJournal> {
    return this.decide(user, id, RecordOperation.Approve, ReviewDecision.Approved, input);
  }

  returnJournal(
    user: RequestUser,
    id: string,
    input: ReturnFieldJournalInput,
  ): Promise<FieldJournal> {
    return this.decide(user, id, RecordOperation.Return, ReviewDecision.ChangesRequested, input);
  }

  /**
   * Orden: 404 → 403 (autorrevisión) → 409 (estado) → 400 (ajustes). La hoja se bloquea antes
   * de leer el estado: una segunda decisión simultánea espera, ve el nuevo estado y responde
   * 409, y el «antes» de cada ajuste es exactamente lo que se reemplaza. Los ajustes son solo
   * de entradas existentes; sus claves en el historial son `entradas.<id>.<columna>`.
   */
  private async decide(
    user: RequestUser,
    id: string,
    operation: typeof RecordOperation.Approve | typeof RecordOperation.Return,
    decision: ReviewDecision,
    input: { comment?: string | null; changes?: { entries: FieldJournalEntryChangeInput[] } },
  ): Promise<FieldJournal> {
    const visible = await this.loadVisible(user, id);
    this.reviews.assertNotSelfReview(visible.teacher.id, user.id);

    await this.repository.lock(id);
    const journal = await this.loadVisible(user, id);
    const { from } = this.transition(operation, RecordActor.Reviewer);
    if (!from.includes(journal.status)) {
      throw new ConflictException(
        `La hoja está ${STATUS_LABEL[journal.status]}: solo se revisan las enviadas`,
      );
    }

    const { changes, updates } = this.planAdjustments(journal, input.changes?.entries);
    const updated = await this.repository.updateIfStatus(id, from, {
      status: REVIEW_DECISION_RESULT_STATUS[decision],
    });
    if (!updated) {
      await this.failTransition(user, id, 'revisar');
    }
    for (const { entryId, content } of updates) {
      await this.repository.updateEntry(id, entryId, content);
    }
    await this.reviews.record({
      recordType: ReviewRecordType.FieldJournal,
      recordId: id,
      reviewerId: user.id,
      decision,
      comment: input.comment ?? null,
      changes,
    });
    return this.loadVisible(user, id);
  }

  /**
   * Valida todos los ajustes antes de escribir nada y calcula, por entrada, qué columnas
   * cambian. Entrada ajena → 400 `changes.entries.<i>.id`; reglas sobre el valor resultante;
   * sin ningún cambio efectivo → 400 `changes`.
   */
  private planAdjustments(
    journal: FieldJournal,
    adjustments: FieldJournalEntryChangeInput[] | undefined,
  ): {
    changes: ReviewFieldChange[];
    updates: { entryId: string; content: JournalEntryContent }[];
  } {
    if (!adjustments) {
      return { changes: [], updates: [] };
    }
    const errors: ApiFieldError[] = [];
    const changes: ReviewFieldChange[] = [];
    const updates: { entryId: string; content: JournalEntryContent }[] = [];

    adjustments.forEach(({ id: entryId, ...adjustment }, index) => {
      const prefix = `changes.entries.${index}.`;
      const entry = journal.entries.find((candidate) => candidate.id === entryId);
      if (!entry) {
        errors.push({ field: `${prefix}id`, reason: 'no es una entrada de esta hoja' });
        return;
      }
      const before = storedOf(entry);
      const content = toStored(adjustment);
      errors.push(...entryErrors({ ...before, ...content }, prefix));
      const entryChanges = diffFields(
        before as Record<string, unknown>,
        { ...before, ...content },
        FIELD_JOURNAL_ENTRY_ADJUSTABLE_FIELDS,
      );
      changes.push(
        ...entryChanges.map((change) => ({
          ...change,
          field: journalEntryChangeField(entryId, change.field),
        })),
      );
      if (entryChanges.length > 0) {
        updates.push({ entryId, content });
      }
    });
    if (errors.length === 0 && changes.length === 0) {
      errors.push({ field: 'changes', reason: 'ningún valor cambia respecto a la hoja' });
    }
    this.throwIfInvalid(errors);
    return { changes, updates };
  }

  // ---------- Comprobaciones ----------

  /**
   * 404 → 403 (no es el dueño) → bloqueo de la hoja → 404 (entrada ajena) → 409 (estado).
   * El bloqueo evita que una entrada se cuele en una hoja que otra pestaña acaba de enviar.
   */
  private async lockEditable(
    user: RequestUser,
    id: string,
    entryId?: string,
  ): Promise<FieldJournal> {
    await this.requireOwner(user, id);
    await this.repository.lock(id);
    const journal = await this.loadVisible(user, id);
    if (entryId && !journal.entries.some((candidate) => candidate.id === entryId)) {
      throw new NotFoundException(ENTRY_NOT_FOUND);
    }
    if (!canTransition(RecordOperation.Edit, RecordActor.Owner, journal.status)) {
      throw new ConflictException(
        `La hoja está ${STATUS_LABEL[journal.status]} y no se pueden modificar sus registros`,
      );
    }
    return journal;
  }

  private async requireOwner(user: RequestUser, id: string): Promise<FieldJournal> {
    const journal = await this.loadVisible(user, id);
    if (journal.teacher.id !== user.id) {
      throw new ForbiddenException(
        'Solo quien creó la hoja puede modificarla; coordinación revisa y ajusta al aprobar o devolver',
      );
    }
    return journal;
  }

  private async loadVisible(user: RequestUser, id: string): Promise<FieldJournal> {
    const journal = await this.repository.findById(id);
    if (!journal || (!isReviewer(user) && journal.teacher.id !== user.id)) {
      throw new NotFoundException(NOT_FOUND);
    }
    return journal;
  }

  private throwIfInvalid(errors: ApiFieldError[]): void {
    if (errors.length > 0) {
      throw new RequestValidationException(errors);
    }
  }

  private transition(operation: RecordOperation, actor: RecordActor) {
    const transition = allowedFrom(operation, actor);
    if (!transition) {
      throw new Error(`La máquina de estados no define ${operation} para ${actor}`);
    }
    return transition;
  }

  /** El UPDATE condicional no encontró la hoja en el estado esperado: otra petición la movió. */
  private async failTransition(user: RequestUser, id: string, verb: string): Promise<never> {
    const journal = await this.loadVisible(user, id);
    throw new ConflictException(
      `La hoja cambió de estado (${STATUS_LABEL[journal.status]}) y no se pudo ${verb}`,
    );
  }
}
