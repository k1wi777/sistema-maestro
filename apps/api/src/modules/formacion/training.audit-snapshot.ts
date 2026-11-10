import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../core/audit/audit-snapshot';
import { TrainingContentService } from './content/training-content.service';
import { TrainingPlansService } from './plans/training-plans.service';

/** Plan y sus secciones: `params.id` de las escrituras de plan y de sección nueva u orden. */
@Injectable()
export class TrainingPlanAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly plans: TrainingPlansService) {}

  load(id: string): Promise<Record<string, unknown> | null> {
    return this.plans.planForAudit(id);
  }
}

/** Sección y sus módulos; tras borrarla queda `después = null`. */
@Injectable()
export class TrainingSectionAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly plans: TrainingPlansService) {}

  load(id: string): Promise<Record<string, unknown> | null> {
    return this.plans.sectionForAudit(id);
  }
}

/**
 * Módulo con diapositivas, preguntas y actividades: `params.id` de toda escritura de contenido.
 * El diff de primer nivel de la bitácora deja ver cuál sección cambió; `limitAuditData` acota las
 * configuraciones grandes.
 */
@Injectable()
export class TrainingModuleAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly content: TrainingContentService) {}

  load(id: string): Promise<Record<string, unknown> | null> {
    return this.content.moduleForAudit(id);
  }
}
