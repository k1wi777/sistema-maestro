import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { AuditModule } from '../auditoria/audit.module';
import { StructureModule } from '../estructura/structure.module';
import { IdentityModule } from '../identidad/identity.module';
import { CertificateVerificationController } from './certificates/certificate-verification.controller';
import { CertificatesService } from './certificates/certificates.service';
import { TrainingCertificatesController } from './certificates/training-certificates.controller';
import { CERTIFICATES_REPOSITORY } from './certificates/certificates.repository';
import { PrismaCertificatesRepository } from './certificates/prisma-certificates.repository';
import { PrismaTrainingContentRepository } from './content/prisma-training-content.repository';
import { TRAINING_CONTENT_REPOSITORY } from './content/training-content.repository';
import { TrainingContentService } from './content/training-content.service';
import { TrainingModulesController } from './content/training-modules.controller';
import { PrismaTrainingFilesRepository } from './files/prisma-training-files.repository';
import { TrainingModuleFilesController } from './files/training-module-files.controller';
import { TRAINING_FILES_REPOSITORY } from './files/training-files.repository';
import { TrainingFilesService } from './files/training-files.service';
import { TrainingGamesService } from './games/training-games.service';
import { PrismaTrainingPlanRepository } from './plans/prisma-training-plan.repository';
import { TRAINING_PLAN_REPOSITORY } from './plans/training-plan.repository';
import {
  TrainingPlansController,
  TrainingSectionsController,
} from './plans/training-plans.controller';
import { TrainingPlansService } from './plans/training-plans.service';
import { ModuleCompletionService } from './progress/module-completion.service';
import { PrismaTrainingTrackingRepository } from './tracking/prisma-training-tracking.repository';
import { TrainingTrackingController } from './tracking/training-tracking.controller';
import { TRAINING_TRACKING_REPOSITORY } from './tracking/training-tracking.repository';
import { TrainingTrackingService } from './tracking/training-tracking.service';
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
  imports: [DatabaseModule, StorageModule, StructureModule, IdentityModule, AuditModule],
  controllers: [
    TrainingPlansController,
    TrainingSectionsController,
    TrainingModulesController,
    TrainingModuleFilesController,
    TrainingCertificatesController,
    CertificateVerificationController,
    TrainingTrackingController,
    MyTrainingController,
  ],
  providers: [
    TrainingPlansService,
    TrainingContentService,
    TrainingRouteService,
    TrainingProgressService,
    TrainingGamesService,
    TrainingFilesService,
    CertificatesService,
    TrainingTrackingService,
    ModuleCompletionService,
    TrainingMilestones,
    TrainingPlanAuditSnapshot,
    TrainingSectionAuditSnapshot,
    TrainingModuleAuditSnapshot,
    { provide: TRAINING_PLAN_REPOSITORY, useClass: PrismaTrainingPlanRepository },
    { provide: TRAINING_CONTENT_REPOSITORY, useClass: PrismaTrainingContentRepository },
    { provide: TRAINING_TRACKING_REPOSITORY, useClass: PrismaTrainingTrackingRepository },
    { provide: CERTIFICATES_REPOSITORY, useClass: PrismaCertificatesRepository },
    { provide: TRAINING_FILES_REPOSITORY, useClass: PrismaTrainingFilesRepository },
    { provide: TRAINING_PROGRESS_REPOSITORY, useClass: PrismaTrainingProgressRepository },
  ],
})
export class TrainingModule {}
