import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  TrainingModuleStatus,
  type CreateTrainingModuleInput,
  type CreateTrainingPlanInput,
  type CreateTrainingSectionInput,
  type TrainingModule,
  type TrainingPlan,
  type TrainingPlanList,
  type TrainingPlanTree,
  type TrainingSection,
  type TrainingSectionWithModules,
  type UpdateTrainingModuleInput,
  type UpdateTrainingPlanInput,
  type UpdateTrainingSectionInput,
} from '@gns/shared';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/database/transaction-runner';
import { AreasService } from '../../estructura/catalogs/area/areas.service';
import { SchoolYearsService } from '../../estructura/school-years/school-years.service';
import { assertCompleteOrder } from './training-order';
import { TRAINING_PLAN_REPOSITORY, type TrainingPlanRepository } from './training-plan.repository';

type ModuleAction = 'publish' | 'withdraw' | 'restore';

/** Única tabla de transiciones del módulo (R4): cualquier otra es 409. */
const TRANSITIONS: Record<
  ModuleAction,
  { from: TrainingModuleStatus; to: TrainingModuleStatus; message: string }
> = {
  publish: {
    from: TrainingModuleStatus.Draft,
    to: TrainingModuleStatus.Active,
    message: 'Solo se puede publicar un módulo en borrador',
  },
  withdraw: {
    from: TrainingModuleStatus.Active,
    to: TrainingModuleStatus.OutOfPlan,
    message: 'Solo se puede sacar del plan un módulo activo',
  },
  restore: {
    from: TrainingModuleStatus.OutOfPlan,
    to: TrainingModuleStatus.Active,
    message: 'Solo se puede restaurar un módulo que está fuera del plan',
  },
};

/** Planes, secciones y módulos de formación (coordinación). */
@Injectable()
export class TrainingPlansService {
  constructor(
    @Inject(TRAINING_PLAN_REPOSITORY) private readonly repository: TrainingPlanRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
    private readonly areas: AreasService,
    private readonly schoolYears: SchoolYearsService,
  ) {}

  // ---------- Planes ----------

  async listPlans(): Promise<TrainingPlanList> {
    return { items: await this.repository.listPlans() };
  }

  async getPlan(id: string): Promise<TrainingPlan> {
    const plan = await this.repository.findPlan(id);
    if (!plan) {
      throw new NotFoundException('Plan de formación no encontrado');
    }
    return plan;
  }

  createPlan(input: CreateTrainingPlanInput): Promise<TrainingPlan> {
    return this.transactions.run(async () => {
      await this.requireKnownReferences(input.areaId, input.schoolYear);
      await this.repository.lockPlanCreation();
      await this.requireFreeSlot(input.areaId, input.schoolYear, null);
      return this.repository.createPlan(input);
    });
  }

  updatePlan(id: string, input: UpdateTrainingPlanInput): Promise<TrainingPlan> {
    return this.transactions.run(async () => {
      const current = await this.getPlan(id);
      await this.requireKnownReferences(null, input.schoolYear ?? null);
      await this.repository.lockPlanCreation();
      await this.repository.lockPlan(id);
      if (input.schoolYear !== undefined) {
        await this.requireFreeSlot(current.areaId, input.schoolYear, id);
      }
      return this.repository.updatePlan(id, input);
    });
  }

  /** Árbol de edición: secciones en orden con sus módulos de todos los estados. */
  async tree(planId: string): Promise<TrainingPlanTree> {
    const plan = await this.getPlan(planId);
    return { plan, sections: await this.repository.listSectionsWithModules(planId) };
  }

  /** Plan y secciones para la bitácora (`null` si el plan no existe). */
  async planForAudit(id: string): Promise<Record<string, unknown> | null> {
    const plan = await this.repository.findPlan(id);
    if (!plan) {
      return null;
    }
    const sections = await this.repository.listSectionsWithModules(id);
    return {
      name: plan.name,
      areaId: plan.areaId,
      schoolYear: plan.schoolYear,
      sections: sections.map(({ id: sectionId, title, subtitle, sortOrder }) => ({
        id: sectionId,
        title,
        subtitle,
        sortOrder,
      })),
    };
  }

  private async requireKnownReferences(
    areaId: string | null,
    schoolYear: string | null,
  ): Promise<void> {
    if (areaId && !(await this.areas.find(areaId))) {
      throw new BadRequestException('El área no existe');
    }
    if (schoolYear && !(await this.schoolYears.findByCode(schoolYear))) {
      throw new BadRequestException('El año lectivo no existe');
    }
  }

  /** Un plan por área (o General) y año lectivo; se comprueba con el candado de planes tomado. */
  private async requireFreeSlot(
    areaId: string | null,
    schoolYear: string | null,
    ignoreId: string | null,
  ): Promise<void> {
    const existing = await this.repository.findPlanByAreaAndYear(areaId, schoolYear);
    if (existing && existing.id !== ignoreId) {
      throw new ConflictException('Ya existe un plan de formación para esa área y ese año lectivo');
    }
  }

  // ---------- Secciones ----------

  private async getSection(id: string): Promise<TrainingSection> {
    const section = await this.repository.findSection(id);
    if (!section) {
      throw new NotFoundException('Sección no encontrada');
    }
    return section;
  }

  createSection(planId: string, input: CreateTrainingSectionInput): Promise<TrainingSection> {
    return this.transactions.run(async () => {
      await this.getPlan(planId);
      await this.repository.lockPlan(planId);
      return this.repository.createSection(planId, input);
    });
  }

  updateSection(id: string, input: UpdateTrainingSectionInput): Promise<TrainingSection> {
    return this.transactions.run(async () => {
      await this.getSection(id);
      return this.repository.updateSection(id, input);
    });
  }

  /** Solo se quita una sección vacía; con módulos, 409 (R2). */
  deleteSection(id: string): Promise<void> {
    return this.transactions.run(async () => {
      const section = await this.getSection(id);
      // Plan y sección bloqueados, en ese orden: un alta de módulo simultánea gana o espera.
      await this.repository.lockPlan(section.planId);
      await this.repository.lockSection(id);
      if ((await this.repository.countModulesInSection(id)) > 0) {
        throw new ConflictException('No se puede quitar una sección que tiene módulos');
      }
      await this.repository.deleteSection(id);
    });
  }

  setSectionOrder(planId: string, ids: readonly string[]): Promise<TrainingPlanTree> {
    return this.transactions.run(async () => {
      await this.getPlan(planId);
      await this.repository.lockPlan(planId);
      assertCompleteOrder(ids, await this.repository.listSectionIds(planId));
      await this.repository.setSectionOrder(ids);
      return this.tree(planId);
    });
  }

  /** Sección y sus módulos para la bitácora. */
  async sectionForAudit(id: string): Promise<Record<string, unknown> | null> {
    const section = await this.repository.findSection(id);
    if (!section) {
      return null;
    }
    const sections = await this.repository.listSectionsWithModules(section.planId);
    const withModules = sections.find((candidate) => candidate.id === id);
    return {
      title: section.title,
      subtitle: section.subtitle,
      sortOrder: section.sortOrder,
      modules: (withModules?.modules ?? []).map(
        ({ id: moduleId, number, title, status, sortOrder }) => ({
          id: moduleId,
          number,
          title,
          status,
          sortOrder,
        }),
      ),
    };
  }

  async sectionWithModules(id: string): Promise<TrainingSectionWithModules> {
    const section = await this.getSection(id);
    const sections = await this.repository.listSectionsWithModules(section.planId);
    const found = sections.find((candidate) => candidate.id === id);
    if (!found) {
      throw new NotFoundException('Sección no encontrada');
    }
    return found;
  }

  // ---------- Módulos ----------

  async getModule(id: string): Promise<TrainingModule> {
    const module = await this.repository.findModule(id);
    if (!module) {
      throw new NotFoundException('Módulo no encontrado');
    }
    return module;
  }

  /** Crea el módulo en borrador al final de la sección (R3). */
  createModule(sectionId: string, input: CreateTrainingModuleInput): Promise<TrainingModule> {
    return this.transactions.run(async () => {
      const section = await this.getSection(sectionId);
      await this.repository.lockSection(sectionId);
      return this.repository.createModule(section, input);
    });
  }

  setModuleOrder(sectionId: string, ids: readonly string[]): Promise<TrainingSectionWithModules> {
    return this.transactions.run(async () => {
      await this.getSection(sectionId);
      await this.repository.lockSection(sectionId);
      assertCompleteOrder(ids, await this.repository.listModuleIds(sectionId));
      await this.repository.setModuleOrder(ids);
      return this.sectionWithModules(sectionId);
    });
  }

  /** Edita los datos del módulo y, si trae `sectionId`, lo mueve al final de esa sección (R6). */
  updateModule(id: string, input: UpdateTrainingModuleInput): Promise<TrainingModule> {
    return this.transactions.run(async () => {
      const module = await this.getModule(id);
      const { sectionId, ...fields } = input;
      if (sectionId !== undefined && sectionId !== module.sectionId) {
        const target = await this.repository.findSection(sectionId);
        if (!target || target.planId !== module.planId) {
          throw new BadRequestException('La sección destino debe ser de este mismo plan');
        }
        // Ambas secciones, en orden de id: dos movimientos cruzados no se bloquean entre sí.
        for (const lockId of [module.sectionId, sectionId].sort()) {
          await this.repository.lockSection(lockId);
        }
      }
      await this.repository.lockModule(id);
      const updated = await this.repository.updateModule(id, fields);
      if (sectionId !== undefined && sectionId !== module.sectionId) {
        return this.repository.moveModule(id, sectionId);
      }
      return updated;
    });
  }

  /** Publica, saca o restaura un módulo; el progreso de los docentes no se toca (R8). */
  changeStatus(id: string, action: ModuleAction): Promise<TrainingModule> {
    return this.transactions.run(async () => {
      const module = await this.getModule(id);
      await this.repository.lockModule(id);
      const transition = TRANSITIONS[action];
      // Con la fila bloqueada se relee el estado: una decisión concurrente gana.
      const current = await this.getModule(id);
      if (current.status !== transition.from) {
        throw new ConflictException(transition.message);
      }
      if (action === 'publish') {
        await this.requirePublishable(module);
      }
      return this.repository.setModuleStatus(id, transition.to);
    });
  }

  /** Publicar exige al menos un paso exigible: video, diapositivas o presentación, preguntas o actividad (R5). */
  private async requirePublishable(module: TrainingModule): Promise<void> {
    const counts = await this.repository.countContent(module.id);
    const hasStep =
      module.videoUrl !== null ||
      module.presentationUrl !== null ||
      counts.slides > 0 ||
      counts.questions > 0 ||
      counts.activeActivities > 0;
    if (!hasStep) {
      throw new ConflictException(
        'Un módulo necesita al menos un paso (video, diapositivas, presentación, preguntas o una actividad) para publicarse',
      );
    }
  }
}
