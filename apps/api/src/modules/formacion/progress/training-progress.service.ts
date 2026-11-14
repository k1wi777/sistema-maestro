import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  parseActivityConfig,
  TrainingActivityType,
  type SimulatorUseResult,
  type ViewMark,
  type WheelStampBody,
  type WheelStampResult,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/database/transaction-runner';
import { TrainingRouteService } from '../route/training-route.service';
import { validStamps } from '../route/teacher-projection';
import { ModuleCompletionService } from './module-completion.service';
import { TrainingMilestones } from './training-milestones';
import {
  TRAINING_PROGRESS_REPOSITORY,
  type TrainingProgressRepository,
} from './training-progress.repository';

/** Marcas de video y presentación, sellos de la ruleta y uso del simulador (BE-74). */
@Injectable()
export class TrainingProgressService {
  constructor(
    @Inject(TRAINING_PROGRESS_REPOSITORY) private readonly repository: TrainingProgressRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
    private readonly route: TrainingRouteService,
    private readonly completion: ModuleCompletionService,
    private readonly milestones: TrainingMilestones,
  ) {}

  /** La fecha de la primera marca se conserva en las repetidas, que responden 200 igual (R19). */
  async markVideo(user: RequestUser, moduleId: string): Promise<ViewMark> {
    const module = await this.route.requireVisibleModule(user, moduleId);
    if (module.videoUrl === null && module.videoFile === null) {
      throw new ConflictException('Este módulo no tiene video');
    }
    return this.transactions.run(async () => {
      const progress = await this.repository.lockModuleProgress(user.id, moduleId);
      let current = progress;
      if (!progress.videoViewedAt) {
        current = await this.repository.updateModuleProgress(progress.id, {
          videoViewedAt: new Date(),
        });
        await this.milestones.videoViewed(
          user,
          progress.id,
          moduleId,
          current.videoViewedAt as Date,
        );
      }
      const completedAt = await this.completion.evaluate(user, moduleId, current);
      return { viewedAt: current.videoViewedAt as Date, completedAt };
    });
  }

  /** La presentación la marca el cliente al llegar a la última diapositiva: el servidor no puede comprobar la lectura. */
  async markPresentation(user: RequestUser, moduleId: string): Promise<ViewMark> {
    const module = await this.route.requireVisibleModule(user, moduleId);
    if (
      module.slideCount === 0 &&
      module.presentationUrl === null &&
      module.presentationFile === null
    ) {
      throw new ConflictException('Este módulo no tiene presentación');
    }
    return this.transactions.run(async () => {
      const progress = await this.repository.lockModuleProgress(user.id, moduleId);
      let current = progress;
      if (!progress.presentationViewedAt) {
        current = await this.repository.updateModuleProgress(progress.id, {
          presentationViewedAt: new Date(),
        });
        await this.milestones.presentationViewed(
          user,
          progress.id,
          moduleId,
          current.presentationViewedAt as Date,
        );
      }
      const completedAt = await this.completion.evaluate(user, moduleId, current);
      return { viewedAt: current.presentationViewedAt as Date, completedAt };
    });
  }

  /** Sello de la ruleta: se verifica la respuesta con la configuración y solo la correcta suma (R20). */
  async stamp(
    user: RequestUser,
    activityId: string,
    body: WheelStampBody,
  ): Promise<WheelStampResult> {
    const scope = await this.route.requireVisibleActivity(user, activityId);
    if (scope.activity.type !== TrainingActivityType.WheelPassport) {
      throw new ConflictException('Esta actividad no es una ruleta con pasaporte');
    }
    const config = parseActivityConfig(TrainingActivityType.WheelPassport, scope.activity.config);
    if (!config.success) {
      throw new ConflictException('La configuración de la actividad no es válida');
    }
    const card = config.data.tarjetas.find((candidate) => candidate.clave === body.cardKey);
    if (!card) {
      throw new NotFoundException('La tarjeta no existe en esta actividad');
    }
    if (body.optionIndex >= card.pregunta.opciones.length) {
      throw new BadRequestException('La opción no existe en la pregunta de la tarjeta');
    }
    const correct = body.optionIndex === card.pregunta.correcta;

    return this.transactions.run(async () => {
      const moduleId = scope.activity.moduleId;
      // Siempre módulo y luego actividad: la actividad puede terminar el módulo.
      const moduleProgress = await this.repository.lockModuleProgress(user.id, moduleId);
      const progress = await this.repository.lockActivityProgress(user.id, activityId);
      let stamps = validStamps(scope.activity, progress);
      let completedAt = progress.completedAt;
      if (correct && !stamps.includes(card.clave)) {
        stamps = [...stamps, card.clave];
        const completesNow = stamps.length === config.data.tarjetas.length && completedAt === null;
        completedAt = completesNow ? new Date() : completedAt;
        await this.repository.updateActivityProgress(progress.id, {
          detail: { sellos: stamps },
          attempts: progress.attempts + 1,
          ...(completesNow && completedAt ? { completedAt } : {}),
        });
        if (completesNow && completedAt) {
          await this.milestones.activityCompleted(user, progress.id, activityId, completedAt);
        }
      }
      await this.completion.evaluate(user, moduleId, moduleProgress);
      return { correct, correctIndex: card.pregunta.correcta, stamps, completedAt };
    });
  }

  /** Uso del simulador: solo cuenta que se usó; ningún valor de las entradas llega ni se guarda (R21). */
  async useSimulator(user: RequestUser, activityId: string): Promise<SimulatorUseResult> {
    const scope = await this.route.requireVisibleActivity(user, activityId);
    if (scope.activity.type !== TrainingActivityType.Simulator) {
      throw new ConflictException('Esta actividad no es un simulador');
    }
    return this.transactions.run(async () => {
      const moduleId = scope.activity.moduleId;
      const moduleProgress = await this.repository.lockModuleProgress(user.id, moduleId);
      const progress = await this.repository.lockActivityProgress(user.id, activityId);
      const firstUse = progress.completedAt === null;
      const now = new Date();
      const updated = await this.repository.updateActivityProgress(progress.id, {
        attempts: progress.attempts + 1,
        ...(firstUse ? { completedAt: now } : {}),
      });
      if (firstUse) {
        await this.milestones.activityCompleted(user, progress.id, activityId, now);
      }
      await this.completion.evaluate(user, moduleId, moduleProgress);
      return { attempts: updated.attempts, completedAt: updated.completedAt };
    });
  }
}
