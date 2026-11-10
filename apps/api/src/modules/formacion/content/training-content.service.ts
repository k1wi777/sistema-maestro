import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  parseActivityConfig,
  TrainingActivityStatus,
  type Activity,
  type ChallengeQuestion,
  type ChallengeQuestionInput,
  type CreateActivityInput,
  type CreateSlideInput,
  type Slide,
  type TrainingModuleDetail,
  type UpdateActivityInput,
  type UpdateSlideInput,
} from '@gns/shared';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/database/transaction-runner';
import {
  TRAINING_PLAN_REPOSITORY,
  type TrainingPlanRepository,
} from '../plans/training-plan.repository';
import { assertCompleteOrder } from '../plans/training-order';
import {
  TRAINING_CONTENT_REPOSITORY,
  type TrainingContentRepository,
} from './training-content.repository';

/** Diapositivas, preguntas del Desafío y actividades de un módulo (coordinación). */
@Injectable()
export class TrainingContentService {
  constructor(
    @Inject(TRAINING_CONTENT_REPOSITORY) private readonly repository: TrainingContentRepository,
    @Inject(TRAINING_PLAN_REPOSITORY) private readonly plans: TrainingPlanRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
  ) {}

  /** Editor completo del módulo, con las soluciones. */
  async getDetail(moduleId: string): Promise<TrainingModuleDetail> {
    const module = await this.plans.findModule(moduleId);
    if (!module) {
      throw new NotFoundException('Módulo no encontrado');
    }
    const [slides, questions, activities] = await Promise.all([
      this.repository.listSlides(moduleId),
      this.repository.listQuestions(moduleId),
      this.repository.listActivities(moduleId),
    ]);
    return { ...module, slides, questions, activities };
  }

  /** Módulo y contenido para la bitácora (`null` si no existe). */
  async moduleForAudit(moduleId: string): Promise<Record<string, unknown> | null> {
    if (!(await this.plans.findModule(moduleId))) {
      return null;
    }
    const detail = await this.getDetail(moduleId);
    return {
      number: detail.number,
      title: detail.title,
      summary: detail.summary,
      status: detail.status,
      sectionId: detail.sectionId,
      videoUrl: detail.videoUrl,
      videoTitle: detail.videoTitle,
      presentationUrl: detail.presentationUrl,
      approvalThreshold: detail.approvalThreshold,
      secondsPerQuestion: detail.secondsPerQuestion,
      slides: detail.slides,
      questions: detail.questions,
      activities: detail.activities,
    };
  }

  /** Bloquea el módulo para escribir su contenido; 404 si no existe. */
  private async lock(moduleId: string): Promise<void> {
    if (!(await this.repository.lockModule(moduleId))) {
      throw new NotFoundException('Módulo no encontrado');
    }
  }

  // ---------- Diapositivas ----------

  addSlide(moduleId: string, input: CreateSlideInput): Promise<Slide> {
    return this.transactions.run(async () => {
      await this.lock(moduleId);
      return this.repository.createSlide(moduleId, input);
    });
  }

  updateSlide(moduleId: string, slideId: string, input: UpdateSlideInput): Promise<Slide> {
    return this.transactions.run(async () => {
      await this.lock(moduleId);
      await this.requireSlide(moduleId, slideId);
      return this.repository.updateSlide(slideId, input);
    });
  }

  removeSlide(moduleId: string, slideId: string): Promise<void> {
    return this.transactions.run(async () => {
      await this.lock(moduleId);
      await this.requireSlide(moduleId, slideId);
      await this.repository.deleteSlide(slideId);
    });
  }

  setSlideOrder(moduleId: string, ids: readonly string[]): Promise<TrainingModuleDetail> {
    return this.transactions.run(async () => {
      await this.lock(moduleId);
      assertCompleteOrder(ids, await this.repository.listSlideIds(moduleId));
      await this.repository.setSlideOrder(ids);
      return this.getDetail(moduleId);
    });
  }

  private async requireSlide(moduleId: string, slideId: string): Promise<void> {
    if (!(await this.repository.findSlide(moduleId, slideId))) {
      throw new NotFoundException('Diapositiva no encontrada en este módulo');
    }
  }

  // ---------- Preguntas ----------

  addQuestion(moduleId: string, input: ChallengeQuestionInput): Promise<ChallengeQuestion> {
    return this.transactions.run(async () => {
      await this.lock(moduleId);
      return this.repository.createQuestion(moduleId, input);
    });
  }

  /** Reemplaza la pregunta y sus opciones en una transacción: se guarda completa o no se guarda. */
  replaceQuestion(
    moduleId: string,
    questionId: string,
    input: ChallengeQuestionInput,
  ): Promise<ChallengeQuestion> {
    return this.transactions.run(async () => {
      await this.lock(moduleId);
      await this.requireQuestion(moduleId, questionId);
      return this.repository.replaceQuestion(questionId, input);
    });
  }

  removeQuestion(moduleId: string, questionId: string): Promise<void> {
    return this.transactions.run(async () => {
      await this.lock(moduleId);
      await this.requireQuestion(moduleId, questionId);
      await this.repository.deleteQuestion(questionId);
    });
  }

  setQuestionOrder(moduleId: string, ids: readonly string[]): Promise<TrainingModuleDetail> {
    return this.transactions.run(async () => {
      await this.lock(moduleId);
      assertCompleteOrder(ids, await this.repository.listQuestionIds(moduleId));
      await this.repository.setQuestionOrder(ids);
      return this.getDetail(moduleId);
    });
  }

  private async requireQuestion(moduleId: string, questionId: string): Promise<void> {
    if (!(await this.repository.findQuestion(moduleId, questionId))) {
      throw new NotFoundException('Pregunta no encontrada en este módulo');
    }
  }

  // ---------- Actividades ----------

  addActivity(moduleId: string, input: CreateActivityInput): Promise<Activity> {
    return this.transactions.run(async () => {
      await this.lock(moduleId);
      // Se guarda la configuración ya interpretada por el esquema (con sus valores por defecto).
      const parsed = parseActivityConfig(input.type, input.config);
      if (!parsed.success) {
        throw new BadRequestException('La configuración no es válida para este tipo de actividad');
      }
      return this.repository.createActivity(moduleId, {
        ...input,
        config: parsed.data,
      });
    });
  }

  /** La configuración se valida con el esquema del tipo guardado; el tipo no cambia (R11). */
  updateActivity(
    moduleId: string,
    activityId: string,
    input: UpdateActivityInput,
  ): Promise<Activity> {
    return this.transactions.run(async () => {
      await this.lock(moduleId);
      const activity = await this.requireActivity(moduleId, activityId);
      let config: Record<string, unknown> | undefined;
      if (input.config !== undefined) {
        const parsed = parseActivityConfig(activity.type, input.config);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          throw new BadRequestException(
            `La configuración no es válida para este tipo de actividad${issue ? `: ${issue.message}` : ''}`,
          );
        }
        config = parsed.data;
      }
      return this.repository.updateActivity(activityId, {
        title: input.title,
        isRequired: input.isRequired,
        instructions: input.instructions,
        config,
      });
    });
  }

  withdrawActivity(moduleId: string, activityId: string): Promise<Activity> {
    return this.changeActivityStatus(
      moduleId,
      activityId,
      TrainingActivityStatus.Active,
      TrainingActivityStatus.OutOfPlan,
      'Solo se puede sacar del módulo una actividad activa',
    );
  }

  restoreActivity(moduleId: string, activityId: string): Promise<Activity> {
    return this.changeActivityStatus(
      moduleId,
      activityId,
      TrainingActivityStatus.OutOfPlan,
      TrainingActivityStatus.Active,
      'Solo se puede restaurar una actividad que está fuera del módulo',
    );
  }

  private changeActivityStatus(
    moduleId: string,
    activityId: string,
    from: TrainingActivityStatus,
    to: TrainingActivityStatus,
    message: string,
  ): Promise<Activity> {
    return this.transactions.run(async () => {
      await this.lock(moduleId);
      const activity = await this.requireActivity(moduleId, activityId);
      if (activity.status !== from) {
        throw new ConflictException(message);
      }
      // El progreso, los sellos y los intentos de los docentes se conservan (R8).
      return this.repository.setActivityStatus(activityId, to);
    });
  }

  setActivityOrder(moduleId: string, ids: readonly string[]): Promise<TrainingModuleDetail> {
    return this.transactions.run(async () => {
      await this.lock(moduleId);
      assertCompleteOrder(ids, await this.repository.listActivityIds(moduleId));
      await this.repository.setActivityOrder(ids);
      return this.getDetail(moduleId);
    });
  }

  private async requireActivity(moduleId: string, activityId: string): Promise<Activity> {
    const activity = await this.repository.findActivity(moduleId, activityId);
    if (!activity) {
      throw new NotFoundException('Actividad no encontrada en este módulo');
    }
    return activity;
  }
}
