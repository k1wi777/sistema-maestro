import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AnnotationStatus,
  ContributionStatus,
  JournalHistoryKind,
  JournalStatus,
  ReviewAction,
  ReviewDecision,
  ReviewRecordType,
  UserRole,
  type AcademicPeriod,
  type ApiFieldError,
  type ApproveJournalInput,
  type CreateAnnotationInput,
  type FieldJournal,
  type FieldJournalDay,
  type FieldJournalFilters,
  type FieldJournalSortField,
  type FieldJournalSummary,
  type JournalAnnotation,
  type JournalContributor,
  type JournalHistoryItem,
  type JournalMissing,
  type JournalReviewScope,
  type JournalViewer,
  type ListQuery,
  type Page,
  type ReturnJournalInput,
  type Review,
  type TodayJournals,
  type UpdateAnnotationInput,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import { todayInBogota } from '../../../shared/time/bogota-time';
import type { GroupRoster } from '../../estructura/assignments/group-roster';
import { TeacherAssignmentsService } from '../../estructura/assignments/teacher-assignments.service';
import { AcademicPeriodsService } from '../../estructura/catalogs/academic-period/academic-periods.service';
import { SchoolYearsService } from '../../estructura/school-years/school-years.service';
import { ReviewsService } from '../../planeacion/review/reviews.service';
import { canReviewGrade, isStaff } from '../../../shared/records/review-scope';
import {
  FIELD_JOURNAL_REPOSITORY,
  type AnnotationRow,
  type ContributionRow,
  type FieldJournalRecord,
  type FieldJournalRepository,
  type JournalBase,
  type JournalListExtras,
  type JournalListItem,
  type JournalVisibility,
  type MissingEntry,
  type SubmissionRow,
} from './field-journal.repository';

const NOT_FOUND = 'Diario de campo no encontrado';
const ANNOTATION_NOT_FOUND = 'Anotación no encontrada';
const DAY_CHANGED =
  'El diario de ese día cambió mientras guardabas la anotación. Vuelve a intentarlo.';
const NO_HOMEROOM_REASON =
  'El grupo no tiene director(a) de grupo asignado: no se puede enviar el diario hasta que coordinación lo asigne.';

/** Cómo se nombra cada estado en los mensajes de conflicto («el diario»: masculino). */
const JOURNAL_STATUS_LABEL: Record<JournalStatus, string> = {
  [JournalStatus.InProgress]: 'en curso',
  [JournalStatus.Submitted]: 'enviado',
  [JournalStatus.ChangesRequested]: 'con observaciones',
  [JournalStatus.Reviewed]: 'revisado',
  [JournalStatus.Voided]: 'anulado',
};

const isAdministrator = (user: RequestUser): boolean => user.role === UserRole.Administrator;
const ready = (status: string): boolean =>
  status === AnnotationStatus.Ready || status === AnnotationStatus.Observed;

/** «A, B y C». */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

type RosterLookup = (groupId: string, schoolYear: string) => Promise<GroupRoster | null>;

/** Todo lo que se necesita para componer el diario de un día, exista o no. */
interface JournalContext {
  base: JournalBase | null;
  roster: GroupRoster;
  schoolYear: string;
  date: string;
  annotations: AnnotationRow[];
  contributions: ContributionRow[];
  submissions: SubmissionRow[];
}

@Injectable()
export class FieldJournalsService {
  constructor(
    @Inject(FIELD_JOURNAL_REPOSITORY) private readonly repository: FieldJournalRepository,
    private readonly assignments: TeacherAssignmentsService,
    private readonly schoolYears: SchoolYearsService,
    private readonly periods: AcademicPeriodsService,
    private readonly reviews: ReviewsService,
  ) {}

  // ---------- Lectura ----------

  /** `mine`: diarios de sus grupos (o con anotación suya); `review`: bandeja de coordinación. */
  async list(
    user: RequestUser,
    query: ListQuery<FieldJournalFilters, FieldJournalSortField>,
  ): Promise<Page<FieldJournalSummary>> {
    const visibility = await this.visibilityFor(user, query.filters.scope ?? 'mine');
    // El filtro por coordinadora es de la bandeja de revisión: en «mis diarios» se ignora.
    const filters =
      visibility.kind === 'review' ? query.filters : { ...query.filters, coordinatorId: undefined };
    const page = await this.repository.findPage({ ...query, filters: { ...filters, visibility } });
    const items = await this.summarize(user, page.items);
    return { ...page, items };
  }

  /** Bloque «Hoy»: por cada grupo activo del docente, el diario de hoy si existe. */
  async today(user: RequestUser): Promise<TodayJournals> {
    const year = await this.schoolYears.requireCurrent();
    const date = todayInBogota();
    const groups = (await this.assignments.myGroups(user.id, year.code)).filter(
      (entry) => entry.group.active && entry.grade.active,
    );
    const journals = await this.repository.findByGroupsAndDate(
      groups.map((entry) => entry.group.id),
      date,
    );
    const summaries = new Map(
      (await this.summarize(user, journals)).map((summary) => [summary.group.id, summary]),
    );
    return {
      date,
      groups: groups.map((entry) => ({
        group: entry.group && { id: entry.group.id, name: entry.group.name },
        grade: { id: entry.grade.id, name: entry.grade.name },
        isHomeroomTeacher: entry.isHomeroomTeacher,
        areas: entry.areas,
        journal: summaries.get(entry.group.id) ?? null,
      })),
    };
  }

  /** Cifras por estado y grados y grupos del alcance de revisión de la persona de coordinación. */
  async reviewScope(user: RequestUser): Promise<JournalReviewScope> {
    const unrestricted = isAdministrator(user);
    // Las cifras y los grados son los de la coordinadora (sus grados); administración, todo.
    const visibility: JournalVisibility = {
      kind: 'review',
      coordinatorId: unrestricted ? null : user.id,
      submittedOnly: !unrestricted,
    };
    const [counts, scope] = await Promise.all([
      this.repository.countByStatus(visibility),
      this.repository.findReviewScope(visibility.coordinatorId),
    ]);
    return {
      unrestricted,
      counts: {
        submitted: counts[JournalStatus.Submitted] ?? 0,
        changesRequested: counts[JournalStatus.ChangesRequested] ?? 0,
        reviewed: counts[JournalStatus.Reviewed] ?? 0,
      },
      ...scope,
    };
  }

  async get(user: RequestUser, id: string): Promise<FieldJournal> {
    const context = await this.contextById(user, id);
    return this.compose(user, context) as Promise<FieldJournal>;
  }

  /** Diario de un grupo y fecha: participante o director(a); vacío si nadie ha anotado aún. */
  async day(user: RequestUser, groupId: string, date: string): Promise<FieldJournalDay> {
    const existing = await this.repository.findByKey(groupId, date);
    if (existing) {
      const context = await this.contextById(user, existing.id, true);
      return this.compose(user, context);
    }
    const year = await this.schoolYears.requireCurrent();
    const roster = await this.requireRoster(groupId, year.code);
    if (!roster.teachers.some((teacher) => teacher.id === user.id)) {
      throw new ForbiddenException('No eres docente de ese grupo');
    }
    return this.compose(user, {
      base: null,
      roster,
      schoolYear: year.code,
      date,
      annotations: [],
      contributions: [],
      submissions: [],
    });
  }

  /** Fila con anotaciones y observaciones para la bitácora; sin comprobar visibilidad. */
  findRaw(id: string): Promise<FieldJournalRecord | null> {
    return this.repository.findRecordById(id);
  }

  // ---------- Anotaciones ----------

  /**
   * Orden: 404 (grupo) → 403 (no participante) → 400 (`groupId` inactivo, solo si el diario aún no
   * existe, o si el alta lo crea tras una carrera) → 400 (`date`) → 400 (`areaId`) → 409 (el diario
   * ya no está En curso) → 409 (el diario cambió durante el alta y no se pudo abrir ni crear).
   */
  async addAnnotation(user: RequestUser, input: CreateAnnotationInput): Promise<FieldJournal> {
    const year = await this.schoolYears.requireCurrent();
    const roster = await this.requireRoster(input.groupId, year.code);
    const me = roster.teachers.find((teacher) => teacher.id === user.id);
    if (!me) {
      throw new ForbiddenException('No eres docente de ese grupo');
    }
    const existing = await this.repository.findByKey(input.groupId, input.date);
    if (!existing) {
      this.assertGroupActive(roster);
    }
    await this.assertDateAllowed(input.date, year.code);
    if (!me.areas.some((area) => area.id === input.areaId)) {
      throw new RequestValidationException([
        { field: 'areaId', reason: 'no es una de tus asignaturas en ese grupo' },
      ]);
    }

    const opened = await this.repository.openOrCreate({
      groupId: input.groupId,
      date: input.date,
      schoolYear: year.code,
      createdById: user.id,
    });
    if (!opened) {
      throw new ConflictException(DAY_CHANGED);
    }
    const { id, status, created } = opened;
    // Si el diario visto se descartó y este alta lo creó, el control de grupo inactivo aplica ahora
    // (el 400 revierte la inserción con la transacción).
    if (created && existing) {
      this.assertGroupActive(roster);
    }
    if (status !== JournalStatus.InProgress) {
      throw new ConflictException(
        `El diario está ${JOURNAL_STATUS_LABEL[status]} y no admite nuevas anotaciones`,
      );
    }
    await this.repository.insertAnnotation(id, {
      teacherId: user.id,
      areaId: input.areaId,
      description: input.description,
    });
    await this.repository.touch(id);
    return this.get(user, id);
  }

  /** Un diario nuevo no se admite en un grupo o grado inactivos. */
  private assertGroupActive(roster: GroupRoster): void {
    if (!roster.group.active || !roster.grade.active) {
      throw new RequestValidationException([
        { field: 'groupId', reason: 'el grupo o su grado están inactivos' },
      ]);
    }
  }

  /** Solo el autor; En curso: borrador o lista; Con observaciones: solo las observadas. */
  async updateAnnotation(
    user: RequestUser,
    id: string,
    annotationId: string,
    input: UpdateAnnotationInput,
  ): Promise<FieldJournal> {
    const { context, annotation } = await this.lockOwnAnnotation(user, id, annotationId);
    this.assertEditable(context.base!.status, annotation);
    if (input.areaId) {
      const me = context.roster.teachers.find((teacher) => teacher.id === user.id);
      if (!me?.areas.some((area) => area.id === input.areaId)) {
        throw new RequestValidationException([
          { field: 'areaId', reason: 'no es una de tus asignaturas en ese grupo' },
        ]);
      }
    }
    await this.repository.updateAnnotation(annotationId, input);
    await this.repository.touch(id);
    return this.get(user, id);
  }

  /** Marca lista una anotación propia (también una observada, tras corregirla). */
  async markReady(user: RequestUser, id: string, annotationId: string): Promise<FieldJournal> {
    const { context, annotation } = await this.lockOwnAnnotation(user, id, annotationId);
    this.assertEditable(context.base!.status, annotation);
    // Una anotación ya lista conserva la hora de su primera marca.
    if (annotation.status !== AnnotationStatus.Ready) {
      await this.repository.setAnnotationStatus(annotationId, {
        status: AnnotationStatus.Ready,
        readyAt: new Date(),
      });
      await this.repository.touch(id);
    }
    return this.get(user, id);
  }

  /** Devuelve a borrador una anotación propia: solo mientras el diario está En curso. */
  async markDraft(user: RequestUser, id: string, annotationId: string): Promise<FieldJournal> {
    const { context, annotation } = await this.lockOwnAnnotation(user, id, annotationId);
    if (context.base!.status !== JournalStatus.InProgress) {
      throw new ConflictException(
        `El diario está ${JOURNAL_STATUS_LABEL[context.base!.status]}: solo se vuelve a borrador mientras está en curso`,
      );
    }
    if (annotation.status !== AnnotationStatus.Draft) {
      await this.repository.setAnnotationStatus(annotationId, {
        status: AnnotationStatus.Draft,
        readyAt: null,
      });
      await this.repository.touch(id);
    }
    return this.get(user, id);
  }

  /**
   * Borrado real de una anotación propia en borrador mientras el diario está En curso (nunca
   * enviado); si era la única, también el diario. Orden: 404 (anotación o diario que no ve) → 403
   * (de otra persona) → 409. Bloquea el diario antes de leer el estado: así «Enviar» y otro descarte
   * simultáneos esperan y ven el resultado.
   */
  async discardAnnotation(user: RequestUser, annotationId: string): Promise<void> {
    const found = await this.repository.findAnnotationById(annotationId);
    if (!found) {
      throw new NotFoundException(ANNOTATION_NOT_FOUND);
    }
    const { context, annotation } = await this.lockOwnAnnotation(
      user,
      found.journalId,
      annotationId,
    );
    const journalStatus = context.base!.status;
    if (
      journalStatus !== JournalStatus.InProgress ||
      annotation.status !== AnnotationStatus.Draft ||
      annotation.sent
    ) {
      throw new ConflictException(
        journalStatus === JournalStatus.InProgress
          ? 'Solo se descarta una anotación en borrador'
          : `El diario está ${JOURNAL_STATUS_LABEL[journalStatus]}: solo se descartan borradores de un diario en curso`,
      );
    }
    if (!(await this.repository.deleteDraftAnnotation(annotationId))) {
      throw new ConflictException('La anotación cambió de estado y no se pudo descartar');
    }
    if ((await this.repository.countAnnotations(found.journalId)) === 0) {
      await this.repository.deleteEmptyJournal(found.journalId);
    } else {
      await this.repository.touch(found.journalId);
    }
  }

  /**
   * Para la bitácora del descarte: solo identificadores y catálogo (grupo, fecha, área) y si era la
   * única anotación del diario; sin textos ni nombres. Sin comprobar visibilidad.
   */
  async findAnnotationDiscardSnapshot(
    annotationId: string,
  ): Promise<Record<string, unknown> | null> {
    const annotation = await this.repository.findAnnotationById(annotationId);
    const base = annotation ? await this.repository.findBase(annotation.journalId) : null;
    if (!annotation || !base) {
      return null;
    }
    return {
      id: annotation.id,
      journalId: base.id,
      group: base.group.name,
      date: base.date,
      area: annotation.areaName,
      status: annotation.status,
      journalStatus: base.status,
      onlyAnnotation: (await this.repository.countAnnotations(base.id)) === 1,
    };
  }

  // ---------- Envío y anulación (director(a) de grupo) ----------

  /** Orden: 404 → 409 (sin director(a)) → 403 → 409 (estado) → 400 (sin anotaciones listas). */
  async submit(user: RequestUser, id: string): Promise<FieldJournal> {
    return this.send(user, id, false);
  }

  async resubmit(user: RequestUser, id: string): Promise<FieldJournal> {
    return this.send(user, id, true);
  }

  private async send(user: RequestUser, id: string, resubmission: boolean): Promise<FieldJournal> {
    const context = await this.lockedContext(user, id);
    const base = context.base!;
    this.requireHomeroom(user, context.roster);
    const expectedStatus = resubmission ? JournalStatus.ChangesRequested : JournalStatus.InProgress;
    if (base.status !== expectedStatus) {
      throw new ConflictException(
        `El diario está ${JOURNAL_STATUS_LABEL[base.status]} y no se puede ${resubmission ? 'reenviar' : 'enviar'}`,
      );
    }
    const contributors = this.contributorList(context);
    const readyTeachers = contributors.filter((entry) => entry.ready > 0);
    if (resubmission) {
      const pending = context.annotations.filter(
        (annotation) => annotation.status === AnnotationStatus.Observed,
      );
      if (pending.length > 0) {
        const authors = [...new Set(pending.map((annotation) => annotation.teacherName))];
        throw new RequestValidationException([
          {
            field: 'annotations',
            reason: `quedan anotaciones por corregir de ${joinNames(authors)}`,
          },
        ]);
      }
    } else if (readyTeachers.length === 0) {
      throw new RequestValidationException([
        { field: 'annotations', reason: 'marca lista al menos una anotación antes de enviar' },
      ]);
    }
    const missing: MissingEntry[] = contributors
      .filter((entry) => entry.ready === 0)
      .map((entry) => ({
        teacherId: entry.teacherId,
        status: entry.drafts > 0 ? 'borrador' : 'sin_aporte',
      }));
    const now = new Date();
    await this.repository.updateJournal(id, { status: JournalStatus.Submitted, submittedAt: now });
    await this.repository.markReadySent(id);
    await this.repository.insertSubmission({
      journalId: id,
      directorId: user.id,
      submittedAt: now,
      resubmission,
      readyCount: readyTeachers.length,
      expectedCount: contributors.length,
      missing,
    });
    return this.get(user, id);
  }

  /** El motivo lo registra la bitácora (`detailFromBody`); aquí solo cambia el estado. */
  async voidJournal(user: RequestUser, id: string): Promise<FieldJournal> {
    const context = await this.lockedContext(user, id);
    const base = context.base!;
    if (context.roster.homeroom?.id !== user.id) {
      throw new ForbiddenException(
        'Solo el director o la directora de grupo puede anular el diario',
      );
    }
    if (
      base.status !== JournalStatus.InProgress &&
      base.status !== JournalStatus.ChangesRequested
    ) {
      throw new ConflictException(
        `El diario está ${JOURNAL_STATUS_LABEL[base.status]} y no se puede anular`,
      );
    }
    await this.repository.updateJournal(id, {
      status: JournalStatus.Voided,
      voidedAt: new Date(),
      voidedById: user.id,
    });
    return this.get(user, id);
  }

  // ---------- Revisión de coordinación ----------

  async approve(user: RequestUser, id: string, input: ApproveJournalInput): Promise<FieldJournal> {
    const context = await this.reviewContext(user, id);
    await this.reviews.record({
      recordType: ReviewRecordType.FieldJournal,
      recordId: id,
      reviewerId: user.id,
      decision: ReviewDecision.Approved,
      comment: input.comment ?? null,
      changes: [],
    });
    await this.repository.updateJournal(context.base!.id, { status: JournalStatus.Reviewed });
    return this.get(user, id);
  }

  /** Las observaciones son sobre anotaciones enviadas: 400 `observations.<i>.annotationId`. */
  async returnJournal(
    user: RequestUser,
    id: string,
    input: ReturnJournalInput,
  ): Promise<FieldJournal> {
    const context = await this.reviewContext(user, id);
    const errors: ApiFieldError[] = [];
    input.observations.forEach((observation, index) => {
      const target = context.annotations.find(
        (candidate) => candidate.id === observation.annotationId,
      );
      if (!target || target.status === AnnotationStatus.Draft || !target.sent) {
        errors.push({
          field: `observations.${index}.annotationId`,
          reason: 'no es una anotación enviada de este diario',
        });
      }
    });
    if (errors.length > 0) {
      throw new RequestValidationException(errors);
    }
    const reviewId = await this.reviews.record({
      recordType: ReviewRecordType.FieldJournal,
      recordId: id,
      reviewerId: user.id,
      decision: ReviewDecision.ChangesRequested,
      comment: input.comment ?? null,
      changes: [],
    });
    await this.repository.insertObservations(reviewId, input.observations);
    await this.repository.markObserved(input.observations.map((entry) => entry.annotationId));
    await this.repository.updateJournal(id, { status: JournalStatus.ChangesRequested });
    return this.get(user, id);
  }

  /**
   * Orden: 404 → 403 (fuera de alcance) → 403 (autorrevisión) → bloqueo → 409 (no está Enviado).
   * Solo la coordinadora del grado revisa; administración consulta pero no decide.
   */
  private async reviewContext(user: RequestUser, id: string): Promise<JournalContext> {
    const base = await this.repository.findBase(id);
    if (!base) {
      throw new NotFoundException(NOT_FOUND);
    }
    if (!this.inReviewScope(user, base)) {
      throw new ForbiddenException('Ese diario no es de un grado que coordines');
    }
    await this.repository.lock(id);
    const context = await this.buildContext(user, id);
    const current = context.base!;
    this.assertNotSelfReview(user, context);
    if (current.status !== JournalStatus.Submitted) {
      throw new ConflictException(
        `El diario está ${JOURNAL_STATUS_LABEL[current.status]}: solo se revisan los enviados`,
      );
    }
    return context;
  }

  /** El revisor no es quien envió el diario ni autor de una anotación enviada. */
  private assertNotSelfReview(user: RequestUser, context: JournalContext): void {
    const last = context.submissions[context.submissions.length - 1];
    const involved = [
      ...(last ? [last.directorId] : []),
      ...context.contributions.filter((entry) => entry.ready > 0).map((entry) => entry.teacherId),
    ];
    for (const id of involved) {
      this.reviews.assertNotSelfReview(id, user.id);
    }
  }

  // ---------- Contexto y visibilidad ----------

  private inReviewScope(user: RequestUser, base: JournalBase): boolean {
    return canReviewGrade(user, base.grade.coordinatorId);
  }

  private async visibilityFor(
    user: RequestUser,
    scope: 'mine' | 'review',
  ): Promise<JournalVisibility> {
    if (scope === 'review') {
      if (!isStaff(user)) {
        throw new ForbiddenException('La bandeja de revisión es solo para coordinación');
      }
      // Todo el colegio: la coordinadora desde el primer envío (no «En curso»); administración,
      // todos. «Mis grados» llega como filtro `coordinatorId`.
      return { kind: 'review', coordinatorId: null, submittedOnly: !isAdministrator(user) };
    }
    const year = await this.schoolYears.findCurrent();
    const groups = year ? await this.assignments.myGroups(user.id, year.code) : [];
    return { kind: 'mine', userId: user.id, groupIds: groups.map((entry) => entry.group.id) };
  }

  private async requireRoster(groupId: string, schoolYear: string): Promise<GroupRoster> {
    const roster = await this.assignments.groupRoster(groupId, schoolYear);
    if (!roster) {
      throw new NotFoundException('Grupo no encontrado');
    }
    return roster;
  }

  /**
   * Quién puede ver el diario: participantes y autores; coordinación (de cualquier grado)
   * desde el primer envío y administración siempre.
   */
  private canSee(user: RequestUser, context: JournalContext): boolean {
    const base = context.base!;
    if (isAdministrator(user)) {
      return true;
    }
    if (
      context.roster.teachers.some((teacher) => teacher.id === user.id) ||
      context.annotations.some((annotation) => annotation.teacherId === user.id)
    ) {
      return true;
    }
    return user.role === UserRole.Coordinator && base.submittedAt !== null;
  }

  private async buildContext(user: RequestUser, id: string): Promise<JournalContext> {
    const base = await this.repository.findBase(id);
    if (!base) {
      throw new NotFoundException(NOT_FOUND);
    }
    const [roster, annotations, contributions, submissions] = await Promise.all([
      this.requireRoster(base.groupId, base.schoolYear),
      this.repository.findAnnotations(id, user.id),
      this.repository.contributions(id),
      this.repository.findSubmissions(id),
    ]);
    return {
      base,
      roster,
      schoolYear: base.schoolYear,
      date: base.date,
      annotations,
      contributions,
      submissions,
    };
  }

  /** Lectura: 404 si la persona no puede ver el diario (`day` ya filtró por clave). */
  private async contextById(
    user: RequestUser,
    id: string,
    forDay = false,
  ): Promise<JournalContext> {
    const context = await this.buildContext(user, id);
    if (!this.canSee(user, context)) {
      if (forDay) {
        throw new ForbiddenException('No eres docente de ese grupo');
      }
      throw new NotFoundException(NOT_FOUND);
    }
    return context;
  }

  /** Escritura: bloquea la fila antes de leer el estado (serializa envío, ediciones y decisiones). */
  private async lockedContext(user: RequestUser, id: string): Promise<JournalContext> {
    if (!(await this.repository.findBase(id))) {
      throw new NotFoundException(NOT_FOUND);
    }
    await this.repository.lock(id);
    const context = await this.buildContext(user, id);
    if (!this.canSee(user, context)) {
      throw new NotFoundException(NOT_FOUND);
    }
    return context;
  }

  private async lockOwnAnnotation(user: RequestUser, id: string, annotationId: string) {
    const context = await this.lockedContext(user, id);
    const annotation = context.annotations.find((candidate) => candidate.id === annotationId);
    if (!annotation) {
      throw new NotFoundException(ANNOTATION_NOT_FOUND);
    }
    if (annotation.teacherId !== user.id) {
      throw new ForbiddenException('Solo quien escribió la anotación puede modificarla');
    }
    return { context, annotation };
  }

  /** En curso: borrador o lista; Con observaciones: solo las observadas; otros estados, 409. */
  private assertEditable(status: JournalStatus, annotation: AnnotationRow): void {
    const allowed =
      status === JournalStatus.InProgress
        ? annotation.status !== AnnotationStatus.Observed
        : status === JournalStatus.ChangesRequested &&
          annotation.status === AnnotationStatus.Observed;
    if (!allowed) {
      throw new ConflictException(
        status === JournalStatus.ChangesRequested
          ? 'El diario tiene observaciones: solo se corrigen las anotaciones por corregir'
          : `El diario está ${JOURNAL_STATUS_LABEL[status]} y no se pueden modificar sus anotaciones`,
      );
    }
  }

  private requireHomeroom(user: RequestUser, roster: GroupRoster): void {
    if (!roster.homeroom) {
      throw new ConflictException(NO_HOMEROOM_REASON);
    }
    if (roster.homeroom.id !== user.id) {
      throw new ForbiddenException(
        'Solo el director o la directora de grupo puede enviar el diario a coordinación',
      );
    }
  }

  /** Participantes, o autores con aporte enviado que ya no están en el grupo, con su aporte. */
  private contributorList(context: JournalContext) {
    const byTeacher = new Map(context.contributions.map((entry) => [entry.teacherId, entry]));
    const members = context.roster.teachers.map((teacher) => ({
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      areas: teacher.areas,
      ready: byTeacher.get(teacher.id)?.ready ?? 0,
      drafts: byTeacher.get(teacher.id)?.drafts ?? 0,
      firstReadyAt: byTeacher.get(teacher.id)?.firstReadyAt ?? null,
    }));
    const rostered = new Set(members.map((entry) => entry.teacherId));
    const former = context.contributions
      .filter((entry) => !rostered.has(entry.teacherId) && entry.ready > 0)
      .map((entry) => ({
        teacherId: entry.teacherId,
        teacherName: entry.teacherName,
        areas: entry.areaNames.map((name) => ({ id: name, name })),
        ready: entry.ready,
        drafts: entry.drafts,
        firstReadyAt: entry.firstReadyAt,
      }));
    return [...members, ...former];
  }

  private async assertDateAllowed(date: string, schoolYear: string): Promise<void> {
    if (date > todayInBogota()) {
      throw new RequestValidationException([
        { field: 'date', reason: 'no puede ser posterior a hoy' },
      ]);
    }
    const first = await this.firstDay(schoolYear);
    if (date < first) {
      throw new RequestValidationException([
        { field: 'date', reason: `no puede ser anterior al inicio del año lectivo (${first})` },
      ]);
    }
  }

  /** Inicio del año lectivo: el periodo 1 si tiene fecha; si no, el 1 de enero de su primer año. */
  private async firstDay(schoolYear: string): Promise<string> {
    const periods = await this.periodsOf(schoolYear);
    const first = periods.find((period) => period.number === 1)?.startDate;
    return first ?? `${schoolYear.slice(0, 4)}-01-01`;
  }

  private async periodsOf(schoolYear: string): Promise<AcademicPeriod[]> {
    const periods = await this.periods.list({
      page: 1,
      pageSize: 10,
      sort: { field: 'number', order: 'asc' },
      filters: { schoolYear },
    });
    return periods.items;
  }

  /** Período del año lectivo que contiene la fecha; nulo si ninguno la contiene (fechas nulas no). */
  private async periodOf(
    schoolYear: string,
    date: string,
  ): Promise<{ id: string; number: number } | null> {
    const periods = await this.periodsOf(schoolYear);
    const found = periods.find(
      (period) =>
        period.startDate !== null &&
        period.endDate !== null &&
        period.startDate <= date &&
        date <= period.endDate,
    );
    return found ? { id: found.id, number: found.number } : null;
  }

  // ---------- Composición ----------

  private async summarize(
    user: RequestUser,
    items: JournalListItem[],
  ): Promise<FieldJournalSummary[]> {
    const extras = await this.repository.findListExtras(
      items.map((item) => item.id),
      user.id,
    );
    const rosters = new Map<string, Promise<GroupRoster | null>>();
    const rosterOf: RosterLookup = (groupId, schoolYear) => {
      const key = `${groupId}|${schoolYear}`;
      const cached = rosters.get(key) ?? this.assignments.groupRoster(groupId, schoolYear);
      rosters.set(key, cached);
      return cached;
    };
    const empty: JournalListExtras = {
      readyTeachers: 0,
      lastSubmission: null,
      review: null,
      myObserved: 0,
    };
    const summaries: FieldJournalSummary[] = [];
    for (const item of items) {
      const extra = extras.get(item.id) ?? empty;
      const roster = await rosterOf(item.groupId, item.schoolYear);
      const last = extra.lastSubmission;
      summaries.push({
        id: item.id,
        group: { id: item.groupId, name: item.groupName },
        grade: { id: item.gradeId, name: item.gradeName },
        date: item.date,
        status: item.status,
        homeroomTeacher: roster?.homeroom ?? null,
        readyCount: last ? last.readyCount : extra.readyTeachers,
        expectedCount: last
          ? last.expectedCount
          : Math.max(roster?.teachers.length ?? 0, extra.readyTeachers),
        submittedAt: item.submittedAt,
        reviewer: extra.review?.reviewer ?? null,
        reviewedAt: extra.review?.date ?? null,
        myObservationCount: extra.myObserved,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }
    return summaries;
  }

  private viewerOf(user: RequestUser, context: JournalContext): JournalViewer {
    const { base, roster } = context;
    const status = base?.status ?? JournalStatus.InProgress;
    const me = roster.teachers.find((teacher) => teacher.id === user.id);
    const isHomeroomTeacher = roster.homeroom?.id === user.id;
    const readyTotal = context.contributions.reduce((total, entry) => total + entry.ready, 0);
    const observedAuthors = [
      ...new Set(
        context.annotations
          .filter((annotation) => annotation.status === AnnotationStatus.Observed)
          .map((annotation) => annotation.teacherName),
      ),
    ];
    const open = status === JournalStatus.InProgress || status === JournalStatus.ChangesRequested;

    let blockedReason: string | null = null;
    if (!roster.homeroom && (!base || open)) {
      blockedReason = NO_HOMEROOM_REASON;
    } else if (isHomeroomTeacher && base) {
      if (status === JournalStatus.InProgress && readyTotal === 0) {
        blockedReason = 'Aún no hay ninguna anotación lista para enviar.';
      } else if (status === JournalStatus.ChangesRequested && observedAuthors.length > 0) {
        blockedReason = `Quedan anotaciones por corregir de ${joinNames(observedAuthors)}.`;
      }
    }

    let canReview = false;
    if (base && this.inReviewScope(user, base)) {
      const last = context.submissions[context.submissions.length - 1];
      const involved = new Set([
        ...(last ? [last.directorId] : []),
        ...context.contributions.filter((entry) => entry.ready > 0).map((entry) => entry.teacherId),
      ]);
      canReview = status === JournalStatus.Submitted && !involved.has(user.id);
    }
    return {
      isParticipant: Boolean(me),
      isHomeroomTeacher,
      areas: me?.areas ?? [],
      canAnnotate: Boolean(me) && status === JournalStatus.InProgress,
      canSubmit: isHomeroomTeacher && status === JournalStatus.InProgress && blockedReason === null,
      canResubmit:
        isHomeroomTeacher && status === JournalStatus.ChangesRequested && blockedReason === null,
      canVoid: isHomeroomTeacher && open && Boolean(base),
      canReview,
      blockedReason,
    };
  }

  private async compose(user: RequestUser, context: JournalContext): Promise<FieldJournalDay> {
    const { base, roster } = context;
    const viewer = this.viewerOf(user, context);
    const seesRoster = viewer.isHomeroomTeacher || isStaff(user);
    const lastSubmission = context.submissions[context.submissions.length - 1] ?? null;
    const contributors = this.contributorList(context);
    const readyContributors = contributors.filter((entry) => entry.ready > 0);

    const period = await this.periodOf(context.schoolYear, context.date);
    const [observations, history, users] = base
      ? await Promise.all([
          this.repository.findObservations(base.id),
          this.reviews.history(ReviewRecordType.FieldJournal, base.id),
          this.repository.findUsers(lastSubmission?.missing.map((entry) => entry.teacherId) ?? []),
        ])
      : [[], [] as Review[], []];

    const seesObservation = (annotation: AnnotationRow) =>
      annotation.teacherId === user.id || viewer.isHomeroomTeacher || isStaff(user);
    const annotations: JournalAnnotation[] = context.annotations.map((annotation) => {
      const latest = seesObservation(annotation)
        ? observations.filter((entry) => entry.annotationId === annotation.id).at(-1)
        : undefined;
      return {
        id: annotation.id,
        teacher: { id: annotation.teacherId, fullName: annotation.teacherName },
        area: { id: annotation.areaId, name: annotation.areaName },
        description: annotation.description,
        status: annotation.status,
        readyAt: annotation.readyAt,
        sent: annotation.sent,
        isMine: annotation.teacherId === user.id,
        observation: latest
          ? { text: latest.text, reviewer: latest.reviewer, date: latest.date }
          : null,
        createdAt: annotation.createdAt,
        updatedAt: annotation.updatedAt,
      };
    });

    const contributorViews: JournalContributor[] = seesRoster
      ? contributors.map((entry) => ({
          teacher: { id: entry.teacherId, fullName: entry.teacherName },
          areas: entry.areas,
          status:
            entry.ready > 0
              ? ContributionStatus.Ready
              : entry.drafts > 0
                ? ContributionStatus.Draft
                : ContributionStatus.None,
          readyAt: entry.firstReadyAt,
        }))
      : [];

    const names = new Map(users.map((entry) => [entry.id, entry.fullName]));
    const missing: JournalMissing[] = (lastSubmission?.missing ?? []).map((entry) => {
      const member = roster.teachers.find((teacher) => teacher.id === entry.teacherId);
      return {
        teacher: {
          id: entry.teacherId,
          fullName: member?.fullName ?? names.get(entry.teacherId) ?? 'Docente',
        },
        areas: member?.areas.map((area) => area.name) ?? [],
        status: entry.status === 'borrador' ? ContributionStatus.Draft : ContributionStatus.None,
      };
    });

    const decisions = history.filter((review) => review.action !== ReviewAction.Adjustment);
    const generalReturn = decisions
      .filter((review) => review.action === ReviewAction.ChangesRequested && review.comment)
      .at(-1);
    const approval = decisions.filter((review) => review.action === ReviewAction.Approved).at(-1);

    return {
      id: base?.id ?? null,
      status: base?.status ?? null,
      createdAt: base?.createdAt ?? null,
      updatedAt: base?.updatedAt ?? null,
      schoolYear: context.schoolYear,
      period,
      level: roster.level,
      grade: { id: roster.grade.id, name: roster.grade.name },
      group: { id: roster.group.id, name: roster.group.name },
      date: context.date,
      homeroomTeacher: roster.homeroom,
      submittedAt: base?.submittedAt ?? null,
      readyCount: lastSubmission ? lastSubmission.readyCount : readyContributors.length,
      expectedCount: lastSubmission ? lastSubmission.expectedCount : contributors.length,
      contributors: contributorViews,
      missing,
      annotations,
      generalObservation:
        generalReturn && (viewer.isHomeroomTeacher || isStaff(user))
          ? {
              text: generalReturn.comment ?? '',
              reviewer: generalReturn.reviewer,
              date: generalReturn.date,
            }
          : null,
      signature:
        base?.status === JournalStatus.Reviewed && approval
          ? { reviewer: approval.reviewer, date: approval.date }
          : null,
      history: base ? this.historyOf(base, context, decisions, observations) : [],
      viewer,
    };
  }

  /** Hechos del diario compuestos de datos: nunca incluye textos de anotaciones ni observaciones. */
  private historyOf(
    base: JournalBase,
    context: JournalContext,
    decisions: Review[],
    observations: { reviewId: string }[],
  ): JournalHistoryItem[] {
    const items: JournalHistoryItem[] = [
      { kind: JournalHistoryKind.Opened, at: base.createdAt, actor: base.createdBy, detail: null },
      ...context.annotations.flatMap((annotation) =>
        annotation.readyAt && ready(annotation.status)
          ? [
              {
                kind: JournalHistoryKind.Ready,
                at: annotation.readyAt,
                actor: { id: annotation.teacherId, fullName: annotation.teacherName },
                detail: annotation.areaName,
              },
            ]
          : [],
      ),
      ...context.submissions.map((submission) => ({
        kind: submission.resubmission
          ? JournalHistoryKind.Resubmitted
          : JournalHistoryKind.Submitted,
        at: submission.submittedAt,
        actor: { id: submission.directorId, fullName: submission.directorName },
        detail: `${submission.readyCount} de ${submission.expectedCount} aportes`,
      })),
      ...decisions.map((review) => {
        const count = observations.filter((entry) => entry.reviewId === review.id).length;
        const parts = [
          ...(count > 0 ? [`${count} ${count === 1 ? 'observación' : 'observaciones'}`] : []),
          ...(review.comment ? ['observación general'] : []),
        ];
        return {
          kind:
            review.action === ReviewAction.Approved
              ? JournalHistoryKind.Approved
              : JournalHistoryKind.Returned,
          at: review.date,
          actor: review.reviewer,
          detail: review.action === ReviewAction.Approved ? null : parts.join(' y ') || null,
        };
      }),
      ...(base.voidedAt
        ? [
            {
              kind: JournalHistoryKind.Voided,
              at: base.voidedAt,
              actor: base.voidedBy,
              detail: null,
            },
          ]
        : []),
    ];
    return items.sort((a, b) => a.at.getTime() - b.at.getTime());
  }
}
