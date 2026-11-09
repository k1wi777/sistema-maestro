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
  roleSatisfies,
  UserRole,
  validateLessonPlanForSubmit,
  type ApiFieldError,
  type ApproveLessonPlanInput,
  type CreateLessonPlanInput,
  type LessonPlan,
  type LessonPlanFilters,
  type LessonPlanSortField,
  type ListQuery,
  type Page,
  type Review,
  type ReturnLessonPlanInput,
  type UpdateLessonPlanInput,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import { SchoolYearsService } from '../../estructura/school-years/school-years.service';
import { AcademicPeriodsService } from '../../estructura/catalogs/academic-period/academic-periods.service';
import { TeacherAssignmentsService } from '../../estructura/assignments/teacher-assignments.service';
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

const NOT_FOUND = 'Planeación no encontrada';

const contentOf = (source: LessonPlanContent): LessonPlanContent =>
  Object.fromEntries(
    CONTENT_KEYS.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]),
  );

@Injectable()
export class LessonPlansService {
  constructor(
    @Inject(LESSON_PLAN_REPOSITORY) private readonly repository: LessonPlanRepository,
    private readonly assignments: TeacherAssignmentsService,
    private readonly periods: AcademicPeriodsService,
    private readonly schoolYears: SchoolYearsService,
    private readonly reviews: ReviewsService,
  ) {}

  // ---------- Lectura ----------

  /** Un docente ve solo las suyas; coordinación, todas. */
  list(
    user: RequestUser,
    query: ListQuery<LessonPlanFilters, LessonPlanSortField>,
  ): Promise<Page<LessonPlan>> {
    const filters = isReviewer(user) ? query.filters : { ...query.filters, teacherId: user.id };
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

  async create(user: RequestUser, input: CreateLessonPlanInput): Promise<LessonPlan> {
    const mine = await this.assignments.listMine(user.id);
    const assignment = mine.grades.find(
      (entry) =>
        entry.grade.id === input.gradeId && entry.areas.some((area) => area.id === input.areaId),
    );
    // La interfaz solo ofrece las asignaciones propias: otra combinación es un acceso no permitido.
    if (!assignment) {
      throw new ForbiddenException('No tienes una asignación activa en ese grado y área');
    }

    const { gradeId, areaId, periodId, ...content } = input;
    const errors: ApiFieldError[] = [];
    const period = await this.periods.find(periodId);
    if (!period) {
      errors.push({ field: 'periodId', reason: 'no existe' });
    } else if (period.schoolYear !== mine.schoolYear) {
      errors.push({
        field: 'periodId',
        reason: `debe ser un periodo del año lectivo vigente (${mine.schoolYear})`,
      });
    }
    errors.push(...contentErrors(contentOf(content), {}, assignment.level.name));
    if (errors.length > 0 || !period) {
      throw new RequestValidationException(errors);
    }

    return this.repository.create({
      ...contentOf(content),
      teacherId: user.id,
      gradeId,
      areaId,
      periodId,
      crossCuttingProject: crossCuttingProjectFor(assignment.level.name, period.number),
    });
  }

  async update(user: RequestUser, id: string, input: UpdateLessonPlanInput): Promise<LessonPlan> {
    const plan = await this.requireEditable(user, id);
    const { periodId, ...content } = input;
    const errors = contentErrors(contentOf(content), plan, plan.level.name);

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
    const actors = [
      ...(plan.teacher.id === user.id ? [RecordActor.Owner] : []),
      ...(isReviewer(user) ? [RecordActor.Reviewer] : []),
    ];
    const allowed = actors
      .map((actor) => allowedFrom(RecordOperation.Void, actor))
      .filter((transition) => transition !== null);
    if (allowed.length === 0) {
      throw new ForbiddenException('No puedes anular esta planeación');
    }

    const from = [...new Set(allowed.flatMap((transition) => transition.from))];
    if (!from.includes(plan.status)) {
      throw new ConflictException(
        plan.status === RecordStatus.Reviewed
          ? 'La planeación está revisada: solo coordinación puede anularla'
          : `La planeación está ${STATUS_LABEL[plan.status]} y no se puede anular`,
      );
    }
    if (!(await this.repository.updateIfStatus(id, from, { status: RecordStatus.Voided }))) {
      await this.failTransition(user, id, 'anular');
    }
    return this.loadVisible(user, id);
  }

  // ---------- Revisión de coordinación ----------

  approve(user: RequestUser, id: string, input: ApproveLessonPlanInput): Promise<LessonPlan> {
    return this.decide(user, id, RecordOperation.Approve, ReviewDecision.Approved, input);
  }

  returnPlan(user: RequestUser, id: string, input: ReturnLessonPlanInput): Promise<LessonPlan> {
    return this.decide(user, id, RecordOperation.Return, ReviewDecision.ChangesRequested, input);
  }

  /**
   * Orden: 404 → 403 (autorrevisión) → 409 (estado) → 400 (ajustes). La fila se bloquea antes
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
    if (!plan || (!isReviewer(user) && plan.teacher.id !== user.id)) {
      throw new NotFoundException(NOT_FOUND);
    }
    return plan;
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

const isReviewer = (user: RequestUser): boolean => roleSatisfies(user.role, UserRole.Coordinator);

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
