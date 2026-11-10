import { Inject, Injectable } from '@nestjs/common';
import type { RequestUser } from '../../../core/audit/request-user';
import { isModuleComplete } from './completion';
import { TrainingMilestones } from './training-milestones';
import {
  TRAINING_PROGRESS_REPOSITORY,
  type ModuleProgressRecord,
  type TrainingProgressRepository,
} from './training-progress.repository';

/**
 * Cierra toda escritura de progreso del módulo: evalúa la regla de terminación y fija
 * `terminado_en` una sola vez (R27). Se llama dentro de la transacción con la fila bloqueada,
 * también tras marcas repetidas: si coordinación quitó un requisito, la siguiente escritura lo
 * recoge.
 */
@Injectable()
export class ModuleCompletionService {
  constructor(
    @Inject(TRAINING_PROGRESS_REPOSITORY) private readonly repository: TrainingProgressRepository,
    private readonly milestones: TrainingMilestones,
  ) {}

  /** Devuelve la fecha de terminación del módulo (la ya fijada o la que se fija ahora). */
  async evaluate(
    user: RequestUser,
    moduleId: string,
    progress: ModuleProgressRecord,
  ): Promise<Date | null> {
    const snapshot = await this.repository.completionSnapshot(user.id, moduleId);
    if (!snapshot) {
      return null;
    }
    if (snapshot.moduleCompletedAt) {
      return snapshot.moduleCompletedAt;
    }
    if (!isModuleComplete(snapshot)) {
      return null;
    }
    const completedAt = new Date();
    await this.repository.updateModuleProgress(progress.id, { completedAt });
    await this.milestones.moduleCompleted(user, progress.id, moduleId, completedAt);
    return completedAt;
  }
}
