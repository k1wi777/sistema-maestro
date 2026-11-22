import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  allowedFrom,
  canTransition,
  crossCuttingProjectFor,
  diffFields,
  LESSON_PLAN_ADJUSTABLE_FIELDS,
  levelAllowsCuriocity,
  RecordActor,
  RecordOperation,
  RecordStatus,
  REVIEW_DECISION_RESULT_STATUS,
  ReviewDecision,
  ReviewRecordType,
  validateLessonPlanForSubmit,
  type ApiFieldError,
  type ApproveLessonPlanInput,
  type CreateLessonPlanInput,
  type LessonPlan,
  type LessonPlanFilters,
  type LessonPlanOptions,
  type LessonPlanSortField,
  type ListQuery,
  type Page,
  type Review,
  type ReturnLessonPlanInput,
  type UpdateLessonPlanInput,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import { actorsOf, canReviewGrade, isStaff } from '../../../shared/records/review-scope';
import { GradesService } from '../../estructura/catalogs/grade/grades.service';
import { SchoolYearsService } from '../../estructura/school-years/school-years.service';
import { AcademicPeriodsService } from '../../estructura/catalogs/academic-period/academic-periods.service';
import { LessonPlanOptionsService } from './lesson-plan-options.service';
import { ReviewsService } from '../review/reviews.service';
import {
  LESSON_PLAN_REPOSITORY,
  type LessonPlanContent,
  type LessonPlanRecord,
  type LessonPlanRepository,
} from './lesson-plan.repository';

const CONTENT_KEYS = Object.keys(LESSON_PLAN_ADJUSTABLE_FIELDS) as (keyof LessonPlanContent)[];

/** Cómo se nombra cada estado en los mensajes de conflicto. */
const STATUS_LABEL: Record<RecordStatus, string> = {
  [RecordStatus.Draft]: 'en borrador',
  [RecordStatus.Submitted]: 'enviada',
  [RecordStatus.ChangesRequested]: 'devuelta con observaciones',
  [RecordStatus.Reviewed]: 'revisada',
  [RecordStatus.Voided]: 'anulada',
};

/** Mensaje de 409 al anular: un borrador se descarta en lugar de anularse. */
function voidConflictMessage(status: RecordStatus): string {
  if (status === RecordStatus.Draft) {
    return 'La planeación está en borrador: se descarta en lugar de anularse';
  }
  return status === RecordStatus.Reviewed
    ? 'La planeación está revisada: solo coordinación puede anularla'
    : `La planeación está ${STATUS_LABEL[status]} y no se puede anular`;
}

const NOT_FOUND = 'Planeación no encontrada';
const OUT_OF_SCOPE = 'Esa planeación no es de un grado que coordines';

const contentOf = (source: LessonPlanContent): LessonPlanContent =>
  Object.fromEntries(
    CONTENT_KEYS.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]),
  );

@Injectable()
export class LessonPlansService {
  constructor(
    @Inject(LESSON_PLAN_REPOSITORY) private readonly repository: LessonPlanRepository,
    private readonly optionsService: LessonPlanOptionsService,
    private readonly periods: AcademicPeriodsService,
    private readonly schoolYears: SchoolYearsService,
    private readonly reviews: ReviewsService,
    private readonly grades: GradesService,
  ) {}

  // ---------- Lectura ----------

  /**
   * Un docente ve solo las suyas; coordinación y administración, todas (consultar no es
   * revisar) y con los filtros de docente y coordinadora que pidan. En la query de un docente
   * ambos se ignoran: `teacherId` se sobrescribe con el de la sesión.
   */
  list(
    user: RequestUser,
    query: ListQuery<LessonPlanFilters, LessonPlanSortField>,
  ): Promise<Page<LessonPlan>> {
    const filters = isStaff(user)
      ? query.filters
      : { ...query.filters, teacherId: user.id, coordinatorId: undefined };
    return this.repository.findPage({ ...query, filters });
  }

  get(user: RequestUser, id: string): Promise<LessonPlan> {
    return this.loadVisible(user, id);
  }

  async history(user: RequestUser, id: string): Promise<Review[]> {
    await this.loadVisible(user, id);
    return this.reviews.history(ReviewRecordType.LessonPlan, id);
  }

  /** Fila sin relaciones para la bitácora; sin comprobar visibilidad (no sale por la API). */
  findRaw(id: string): Promise<LessonPlanRecord | null> {
    return this.repository.findRecordById(id);
  }

  // ---------- Escritura del dueño ----------

  /** Grados y áreas con los que el docente puede crear una planeación (casillas de la web). */
  options(user: RequestUser): Promise<LessonPlanOptions> {
    return this.optionsService.forTeacher(user.id);
  }

  async create(user: RequestUser, input: CreateLessonPlanInput): Promise<LessonPlan> {
    const options = await this.optionsService.forTeacher(user.id);
    const entry = options.grades.find((candidate) => candidate.grade.id === input.gradeId);
    // La interfaz solo ofrece los grados propios: otro grado es un acceso no permitido.
    if (!entry) {
      throw new ForbiddenException('No tienes una asignación activa en ese grado');
    }

    const { gradeId, areaIds, periodId, ...content } = input;
    const errors: ApiFieldError[] = areaErrors(areaIds, entry.areas);
    const period = await this.periods.find(periodId);
    if (!period) {
      errors.push({ field: 'periodId', reason: 'no existe' });
    } else if (period.schoolYear !== options.schoolYear) {
      errors.push({
        field: 'periodId',
        reason: `debe ser un periodo del año lectivo vigente (${options.schoolYear})`,
      });
    }
    errors.push(...contentErrors(contentOf(content), {}, entry.level.name));
    if (errors.length > 0 || !period) {
      throw new RequestValidationException(errors);
    }

    return this.repository.create({
      ...contentOf(content),
      teacherId: user.id,
      gradeId,
      areaIds,
      periodId,
      crossCuttingProject: crossCuttingProjectFor(entry.level.name, period.number),
    });
  }

  async update(user: RequestUser, id: string, input: UpdateLessonPlanInput): Promise<LessonPlan> {
    const plan = await this.requireEditable(user, id);
    const { periodId, areaIds, ...content } = input;
    const errors = contentErrors(contentOf(content), plan, plan.level.name);
    if (areaIds) {
      // Las áreas que la planeación ya tenía se conservan sin validar de nuevo; solo las añadidas.
      const saved = new Set(plan.areas.map((area) => area.id));
      const added = areaIds.filter((areaId) => !saved.has(areaId));
      if (added.length > 0) {
        const options = await this.optionsService.forTeacher(user.id);
        const offered =
          options.grades.find((entry) => entry.grade.id === plan.grade.id)?.areas ?? [];
        errors.push(...areaErrors(areaIds, offered, saved));
      }
    }

    let project: { crossCuttingProject: string | null } | undefined;
    if (periodId !== undefined && periodId !== plan.period.id) {
      const period = await this.periods.find(periodId);
      const current = await this.schoolYears.requireCurrent();
      if (!period) {
        errors.push({ field: 'periodId', reason: 'no existe' });
      } else if (period.schoolYear !== current.code) {
        errors.push({
          field: 'periodId',
          reason: `debe ser un periodo del año lectivo vigente (${current.code})`,
        });
      } else {
        project = { crossCuttingProject: crossCuttingProjectFor(plan.level.name, period.number) };
      }
    }
    if (errors.length > 0) {
      throw new RequestValidationException(errors);
    }

    const { from } = this.transition(RecordOperation.Edit, RecordActor.Owner);
    const updated = await this.repository.updateIfStatus(id, from, {
      ...contentOf(content),
      ...(areaIds ? { areaIds } : {}),
      ...(project ? { periodId, ...project } : {}),
    });
    if (!updated) {
      await this.failTransition(user, id, 'editar');
    }
    return this.loadVisible(user, id);
  }

  async submit(user: RequestUser, id: string): Promise<LessonPlan> {
    const plan = await this.requireEditable(user, id, 'enviar');
    const errors = validateLessonPlanForSubmit(plan);
    if (errors.length > 0) {
      throw new RequestValidationException(errors);
    }

    const { from, to } = this.transition(RecordOperation.Submit, RecordActor.Owner);
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
  async voidPlan(user: RequestUser, id: string): Promise<LessonPlan> {
    const plan = await this.loadVisible(user, id);
    const actors = actorsOf(user, plan.teacher.id, await this.coordinatorOf(plan));
    const allowed = actors
      .map((actor) => allowedFrom(RecordOperation.Void, actor))
      .filter((transition) => transition !== null);
    if (allowed.length === 0) {
      throw new ForbiddenException(
        isStaff(user) ? OUT_OF_SCOPE : 'No puedes anular esta planeación',
      );
    }

    const from = [...new Set(allowed.flatMap((transition) => transition.from))];
    if (!from.includes(plan.status)) {
      throw new ConflictException(voidConflictMessage(plan.status));
    }
    if (!(await this.repository.updateIfStatus(id, from, { status: RecordStatus.Voided }))) {
      await this.failTransition(user, id, 'anular');
    }
    return this.loadVisible(user, id);
  }

  /**
   * Borrado real de un borrador que nunca se envió. Orden: 404 (oculta lo ajeno al docente) →
   * 403 (no es el autor) → 409 (ya no es borrador). La fila se bloquea antes de releer el estado,
   * así un envío simultáneo espera y el descarte responde 409 en lugar de borrar lo enviado.
   */
  async discard(user: RequestUser, id: string): Promise<void> {
    const visible = await this.loadVisible(user, id);
    if (visible.teacher.id !== user.id) {
      throw new ForbiddenException('Solo quien creó la planeación puede descartarla');
    }
    await this.repository.lock(id);
    const plan = await this.loadVisible(user, id);
    if (
      !canTransition(RecordOperation.Discard, RecordActor.Owner, plan.status) ||
      plan.submittedAt
    ) {
      throw new ConflictException(
        `La planeación está ${STATUS_LABEL[plan.status]}: solo se descarta un borrador que nunca se envió`,
      );
    }
    if (!(await this.repository.deleteDraft(id))) {
      await this.failTransition(user, id, 'descartar');
    }
  }

  /**
   * Para la bitácora del descarte: solo identificadores y catálogo (estado, grado y áreas), sin
   * textos libres. Sin comprobar visibilidad (no sale por la API).
   */
  async findDiscardSnapshot(id: string): Promise<Record<string, unknown> | null> {
    const plan = await this.repository.findById(id);
    return plan
      ? {
          id: plan.id,
          status: plan.status,
          grade: plan.grade.name,
          areas: plan.areas.map((area) => area.name),
        }
      : null;
  }

  // ---------- Revisión de coordinación ----------

  approve(user: RequestUser, id: string, input: ApproveLessonPlanInput): Promise<LessonPlan> {
    return this.decide(user, id, RecordOperation.Approve, ReviewDecision.Approved, input);
  }

  returnPlan(user: RequestUser, id: string, input: ReturnLessonPlanInput): Promise<LessonPlan> {
    return this.decide(user, id, RecordOperation.Return, ReviewDecision.ChangesRequested, input);
  }

  /**
   * Orden: 404 → 403 (grado ajeno) → 403 (autorrevisión) → 409 (estado) → 400 (ajustes). La fila se bloquea antes
   * de leer el estado: una segunda decisión simultánea espera, ve `revisada` u `observaciones`
   * y responde 409, y el «antes» de los ajustes es exactamente lo que se reemplaza.
   */
  private async decide(
    user: RequestUser,
    id: string,
    operation: typeof RecordOperation.Approve | typeof RecordOperation.Return,
    decision: ReviewDecision,
    input: { comment?: string | null; changes?: LessonPlanContent },
  ): Promise<LessonPlan> {
    const visible = await this.loadVisible(user, id);
    if (!canReviewGrade(user, await this.coordinatorOf(visible))) {
      throw new ForbiddenException(OUT_OF_SCOPE);
    }
    this.reviews.assertNotSelfReview(visible.teacher.id, user.id);

    await this.repository.lock(id);
    const plan = await this.loadVisible(user, id);
    const { from } = this.transition(operation, RecordActor.Reviewer);
    if (!from.includes(plan.status)) {
      throw new ConflictException(
        `La planeación está ${STATUS_LABEL[plan.status]}: solo se revisan las enviadas`,
      );
    }

    const adjustments = contentOf(input.changes ?? {});
    const changes = diffFields(plan, { ...plan, ...adjustments }, LESSON_PLAN_ADJUSTABLE_FIELDS);
    if (input.changes) {
      const errors = contentErrors(adjustments, plan, plan.level.name, 'changes.');
      if (errors.length === 0 && changes.length === 0) {
        errors.push({ field: 'changes', reason: 'ningún valor cambia respecto a la planeación' });
      }
      if (errors.length > 0) {
        throw new RequestValidationException(errors);
      }
    }

    const updated = await this.repository.updateIfStatus(id, from, {
      ...adjustments,
      status: REVIEW_DECISION_RESULT_STATUS[decision],
    });
    if (!updated) {
      await this.failTransition(user, id, 'revisar');
    }
    await this.reviews.record({
      recordType: ReviewRecordType.LessonPlan,
      recordId: id,
      reviewerId: user.id,
      decision,
      comment: input.comment ?? null,
      changes,
    });
    return this.loadVisible(user, id);
  }

  // ---------- Comprobaciones compartidas (también las usa el servicio de recursos) ----------

  /** 404 → 403 (no es el dueño) → 409 (estado). */
  async requireEditable(
    user: RequestUser,
    id: string,
    verb: 'editar' | 'enviar' = 'editar',
  ): Promise<LessonPlan> {
    const plan = await this.loadVisible(user, id);
    if (plan.teacher.id !== user.id) {
      throw new ForbiddenException(
        'Solo quien creó la planeación puede modificarla; coordinación revisa y ajusta al aprobar o devolver',
      );
    }
    const operation = verb === 'enviar' ? RecordOperation.Submit : RecordOperation.Edit;
    if (!canTransition(operation, RecordActor.Owner, plan.status)) {
      throw new ConflictException(
        `La planeación está ${STATUS_LABEL[plan.status]} y no se puede ${verb}`,
      );
    }
    return plan;
  }

  /** Bloquea la planeación hasta el fin de la transacción (tope de enlaces sin carreras). */
  lock(id: string): Promise<void> {
    return this.repository.lock(id);
  }

  private async loadVisible(user: RequestUser, id: string): Promise<LessonPlan> {
    const plan = await this.repository.findById(id);
    if (!plan || (!isStaff(user) && plan.teacher.id !== user.id)) {
      throw new NotFoundException(NOT_FOUND);
    }
    return plan;
  }

  /** Coordinadora del grado de la planeación (`null` si el grado no tiene): quien la revisa. */
  private async coordinatorOf(plan: LessonPlan): Promise<string | null> {
    return (await this.grades.find(plan.grade.id))?.coordinatorId ?? null;
  }

  private transition(operation: RecordOperation, actor: RecordActor) {
    const transition = allowedFrom(operation, actor);
    if (!transition) {
      throw new Error(`La máquina de estados no define ${operation} para ${actor}`);
    }
    return transition;
  }

  /** El UPDATE condicional no encontró la fila en el estado esperado: otra petición la movió. */
  private async failTransition(user: RequestUser, id: string, verb: string): Promise<never> {
    const plan = await this.loadVisible(user, id);
    throw new ConflictException(
      `La planeación cambió de estado (${STATUS_LABEL[plan.status]}) y no se pudo ${verb}`,
    );
  }
}

/** `areaIds.<i>` inválidos: no están entre las áreas ofrecidas del grado (ni entre las ya guardadas). */
function areaErrors(
  areaIds: readonly string[],
  offered: readonly { id: string }[],
  saved: ReadonlySet<string> = new Set(),
): ApiFieldError[] {
  const allowed = new Set(offered.map((area) => area.id));
  return areaIds.flatMap((areaId, index) =>
    allowed.has(areaId) || saved.has(areaId)
      ? []
      : [{ field: `areaIds.${index}`, reason: 'no está disponible para el grado' }],
  );
}

/**
 * Errores de contenido sobre el valor resultante de la petición (la petición puede traer solo
 * una de las dos fechas): fecha final anterior a la inicial y etapa CurioCity fuera de bachillerato.
 */
function contentErrors(
  incoming: LessonPlanContent,
  current: LessonPlanContent,
  levelName: string,
  prefix = '',
): ApiFieldError[] {
  const resulting = { ...current, ...incoming };
  const errors: ApiFieldError[] = [];
  if (resulting.dateFrom && resulting.dateTo && resulting.dateTo < resulting.dateFrom) {
    errors.push({
      field: `${prefix}dateTo`,
      reason: 'no puede ser anterior a la fecha inicial',
    });
  }
  if (incoming.curiocityStage && !levelAllowsCuriocity(levelName)) {
    errors.push({
      field: `${prefix}curiocityStage`,
      reason: 'la etapa CurioCity solo aplica a bachillerato',
    });
  }
  return errors;
}
