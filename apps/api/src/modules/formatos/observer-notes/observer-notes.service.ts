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
  OBSERVER_NOTE_ADJUSTABLE_FIELDS,
  RecordActor,
  RecordOperation,
  RecordStatus,
  REVIEW_DECISION_RESULT_STATUS,
  ReviewDecision,
  ReviewRecordType,
  type ApiFieldError,
  type ApproveObserverNoteInput,
  type CreateObserverNoteInput,
  type ListQuery,
  type ObserverNote,
  type ObserverNoteFilters,
  type ObserverNoteSortField,
  type Page,
  type ReturnObserverNoteInput,
  type Review,
  type UpdateObserverNoteInput,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import { AcademicPeriodsService } from '../../estructura/catalogs/academic-period/academic-periods.service';
import { GradesService } from '../../estructura/catalogs/grade/grades.service';
import { ReviewsService } from '../../planeacion/review/reviews.service';
import { actorsOf, isReviewer, STATUS_LABEL, voidConflictMessage } from '../common/record-rules';
import {
  OBSERVER_NOTE_REPOSITORY,
  type ObserverNoteContent,
  type ObserverNoteQueryFilters,
  type ObserverNoteRecord,
  type ObserverNoteRepository,
} from './observer-note.repository';

const NOT_FOUND = 'Anotación no encontrada';
const CONTENT_KEYS = Object.keys(OBSERVER_NOTE_ADJUSTABLE_FIELDS) as (keyof ObserverNoteContent)[];

const contentOf = (source: ObserverNoteContent): ObserverNoteContent =>
  Object.fromEntries(
    CONTENT_KEYS.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]),
  );

@Injectable()
export class ObserverNotesService {
  constructor(
    @Inject(OBSERVER_NOTE_REPOSITORY) private readonly repository: ObserverNoteRepository,
    private readonly grades: GradesService,
    private readonly periods: AcademicPeriodsService,
    private readonly reviews: ReviewsService,
  ) {}

  // ---------- Lectura ----------

  /**
   * Un docente ve solo las suyas (su filtro de docente se ignora); coordinación, todas. El
   * periodo se traduce a sus fechas: la anotación no tiene periodo propio.
   */
  async list(
    user: RequestUser,
    query: ListQuery<ObserverNoteFilters, ObserverNoteSortField>,
  ): Promise<Page<ObserverNote>> {
    const { periodId, ...rest } = query.filters;
    const filters: ObserverNoteQueryFilters = {
      ...rest,
      ...(isReviewer(user) ? {} : { teacherId: user.id }),
      ...(periodId === undefined ? {} : await this.periodDates(periodId)),
    };
    return this.repository.findPage({ ...query, filters });
  }

  get(user: RequestUser, id: string): Promise<ObserverNote> {
    return this.loadVisible(user, id);
  }

  async history(user: RequestUser, id: string): Promise<Review[]> {
    await this.loadVisible(user, id);
    return this.reviews.history(ReviewRecordType.ObserverNote, id);
  }

  /** Fila sin relaciones para la bitácora; sin comprobar visibilidad (no sale por la API). */
  findRaw(id: string): Promise<ObserverNoteRecord | null> {
    return this.repository.findRecordById(id);
  }

  // ---------- Escritura del dueño ----------

  /** Cualquier grado existente: anotar sobre un estudiante no exige asignación. */
  async create(user: RequestUser, input: CreateObserverNoteInput): Promise<ObserverNote> {
    if (!(await this.grades.find(input.gradeId))) {
      throw new RequestValidationException([{ field: 'gradeId', reason: 'no existe' }]);
    }
    return this.repository.create({ ...input, teacherId: user.id });
  }

  async update(
    user: RequestUser,
    id: string,
    input: UpdateObserverNoteInput,
  ): Promise<ObserverNote> {
    await this.requireEditable(user, id, 'editar');
    const { from } = this.transition(RecordOperation.Edit, RecordActor.Owner);
    if (!(await this.repository.updateIfStatus(id, from, contentOf(input)))) {
      await this.failTransition(user, id, 'editar');
    }
    return this.loadVisible(user, id);
  }

  async submit(user: RequestUser, id: string): Promise<ObserverNote> {
    await this.requireEditable(user, id, 'enviar');
    await this.repository.lock(id);
    const { from, to } = this.transition(RecordOperation.Submit, RecordActor.Owner);
    const updated = await this.repository.updateIfStatus(id, from, {
      status: to ?? RecordStatus.Submitted,
    });
    if (!updated) {
      await this.failTransition(user, id, 'enviar');
    }
    return this.loadVisible(user, id);
  }

  /** El motivo lo registra la bitácora (`detailFromBody`); aquí solo cambia el estado. */
  async voidNote(user: RequestUser, id: string): Promise<ObserverNote> {
    const visible = await this.loadVisible(user, id);
    const from = allowedFromAny(RecordOperation.Void, actorsOf(user, visible.teacher.id));
    if (from.length === 0) {
      throw new ForbiddenException('No puedes anular esta anotación');
    }
    await this.repository.lock(id);
    const note = await this.loadVisible(user, id);
    if (!from.includes(note.status)) {
      throw new ConflictException(voidConflictMessage('anotación', note.status));
    }
    if (!(await this.repository.updateIfStatus(id, from, { status: RecordStatus.Voided }))) {
      await this.failTransition(user, id, 'anular');
    }
    return this.loadVisible(user, id);
  }

  // ---------- Revisión de coordinación ----------

  approve(user: RequestUser, id: string, input: ApproveObserverNoteInput): Promise<ObserverNote> {
    return this.decide(user, id, RecordOperation.Approve, ReviewDecision.Approved, input);
  }

  returnNote(user: RequestUser, id: string, input: ReturnObserverNoteInput): Promise<ObserverNote> {
    return this.decide(user, id, RecordOperation.Return, ReviewDecision.ChangesRequested, input);
  }

  /**
   * Orden: 404 → 403 (autorrevisión) → 409 (estado) → 400 (ajustes). La fila se bloquea antes de
   * leer el estado: una segunda decisión simultánea espera y responde 409, y el «antes» de los
   * ajustes es exactamente lo que se reemplaza.
   */
  private async decide(
    user: RequestUser,
    id: string,
    operation: typeof RecordOperation.Approve | typeof RecordOperation.Return,
    decision: ReviewDecision,
    input: { comment?: string | null; changes?: ObserverNoteContent },
  ): Promise<ObserverNote> {
    const visible = await this.loadVisible(user, id);
    this.reviews.assertNotSelfReview(visible.teacher.id, user.id);

    await this.repository.lock(id);
    const note = await this.loadVisible(user, id);
    const { from } = this.transition(operation, RecordActor.Reviewer);
    if (!from.includes(note.status)) {
      throw new ConflictException(
        `La anotación está ${STATUS_LABEL[note.status]}: solo se revisan las enviadas`,
      );
    }

    const adjustments = contentOf(input.changes ?? {});
    const changes = diffFields(note, { ...note, ...adjustments }, OBSERVER_NOTE_ADJUSTABLE_FIELDS);
    if (input.changes && changes.length === 0) {
      const errors: ApiFieldError[] = [
        { field: 'changes', reason: 'ningún valor cambia respecto a la anotación' },
      ];
      throw new RequestValidationException(errors);
    }

    const updated = await this.repository.updateIfStatus(id, from, {
      ...adjustments,
      status: REVIEW_DECISION_RESULT_STATUS[decision],
    });
    if (!updated) {
      await this.failTransition(user, id, 'revisar');
    }
    await this.reviews.record({
      recordType: ReviewRecordType.ObserverNote,
      recordId: id,
      reviewerId: user.id,
      decision,
      comment: input.comment ?? null,
      changes,
    });
    return this.loadVisible(user, id);
  }

  // ---------- Comprobaciones ----------

  /** 404 → 403 (no es el dueño) → 409 (estado). */
  private async requireEditable(
    user: RequestUser,
    id: string,
    verb: 'editar' | 'enviar',
  ): Promise<ObserverNote> {
    const note = await this.loadVisible(user, id);
    if (note.teacher.id !== user.id) {
      throw new ForbiddenException(
        'Solo quien creó la anotación puede modificarla; coordinación revisa y ajusta al aprobar o devolver',
      );
    }
    const operation = verb === 'enviar' ? RecordOperation.Submit : RecordOperation.Edit;
    if (!canTransition(operation, RecordActor.Owner, note.status)) {
      throw new ConflictException(
        `La anotación está ${STATUS_LABEL[note.status]} y no se puede ${verb}`,
      );
    }
    return note;
  }

  private async periodDates(periodId: string): Promise<{ dateFrom: string; dateTo: string }> {
    const period = await this.periods.find(periodId);
    if (!period) {
      throw new RequestValidationException([{ field: 'periodId', reason: 'no existe' }]);
    }
    if (!period.startDate || !period.endDate) {
      throw new RequestValidationException([
        { field: 'periodId', reason: 'el periodo aún no tiene fechas definidas' },
      ]);
    }
    return { dateFrom: period.startDate, dateTo: period.endDate };
  }

  private async loadVisible(user: RequestUser, id: string): Promise<ObserverNote> {
    const note = await this.repository.findById(id);
    if (!note || (!isReviewer(user) && note.teacher.id !== user.id)) {
      throw new NotFoundException(NOT_FOUND);
    }
    return note;
  }

  private transition(operation: RecordOperation, actor: RecordActor) {
    const transition = allowedFrom(operation, actor);
    if (!transition) {
      throw new Error(`La máquina de estados no define ${operation} para ${actor}`);
    }
    return transition;
  }

  /** El UPDATE condicional no encontró la anotación en el estado esperado: otra petición la movió. */
  private async failTransition(user: RequestUser, id: string, verb: string): Promise<never> {
    const note = await this.loadVisible(user, id);
    throw new ConflictException(
      `La anotación cambió de estado (${STATUS_LABEL[note.status]}) y no se pudo ${verb}`,
    );
  }
}
