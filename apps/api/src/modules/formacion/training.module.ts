import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { AuditModule } from '../auditoria/audit.module';
import { StructureModule } from '../estructura/structure.module';
import { PrismaTrainingContentRepository } from './content/prisma-training-content.repository';
import { TRAINING_CONTENT_REPOSITORY } from './content/training-content.repository';
import { TrainingContentService } from './content/training-content.service';
import { TrainingModulesController } from './content/training-modules.controller';
import { TrainingGamesService } from './games/training-games.service';
import { PrismaTrainingPlanRepository } from './plans/prisma-training-plan.repository';
import { TRAINING_PLAN_REPOSITORY } from './plans/training-plan.repository';
import {
  TrainingPlansController,
  TrainingSectionsController,
} from './plans/training-plans.controller';
import { TrainingPlansService } from './plans/training-plans.service';
import { ModuleCompletionService } from './progress/module-completion.service';
import { PrismaTrainingProgressRepository } from './progress/prisma-training-progress.repository';
import { TrainingMilestones } from './progress/training-milestones';
import { TRAINING_PROGRESS_REPOSITORY } from './progress/training-progress.repository';
import { TrainingProgressService } from './progress/training-progress.service';
import { MyTrainingController } from './route/my-training.controller';
import { TrainingRouteService } from './route/training-route.service';
import {
  TrainingModuleAuditSnapshot,
  TrainingPlanAuditSnapshot,
  TrainingSectionAuditSnapshot,
} from './training.audit-snapshot';

/**
 * Formación: planes con secciones y módulos, contenido (diapositivas, preguntas y actividades),
 * ruta y progreso del docente, y el Desafío GNS con las actividades de juego calificados en el
 * servidor. Usa `StructureModule` (año vigente, asignaciones, áreas) y `AuditModule` (hitos).
 */
@Module({
  imports: [DatabaseModule, StructureModule, AuditModule],
  controllers: [
    TrainingPlansController,
    TrainingSectionsController,
    TrainingModulesController,
    MyTrainingController,
  ],
  providers: [
    TrainingPlansService,
    TrainingContentService,
    TrainingRouteService,
    TrainingProgressService,
    TrainingGamesService,
    ModuleCompletionService,
    TrainingMilestones,
    TrainingPlanAuditSnapshot,
    TrainingSectionAuditSnapshot,
    TrainingModuleAuditSnapshot,
    { provide: TRAINING_PLAN_REPOSITORY, useClass: PrismaTrainingPlanRepository },
    { provide: TRAINING_CONTENT_REPOSITORY, useClass: PrismaTrainingContentRepository },
    { provide: TRAINING_PROGRESS_REPOSITORY, useClass: PrismaTrainingProgressRepository },
  ],
})
export class TrainingModule {}
