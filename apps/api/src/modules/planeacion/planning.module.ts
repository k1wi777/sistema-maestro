import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { StructureModule } from '../estructura/structure.module';
import { LessonPlanAuditSnapshot } from './lesson-plans/lesson-plan.audit-snapshot';
import { LessonPlanReviewController } from './lesson-plans/lesson-plan-review.controller';
import { LESSON_PLAN_REPOSITORY } from './lesson-plans/lesson-plan.repository';
import { LessonPlansController } from './lesson-plans/lesson-plans.controller';
import { LessonPlansService } from './lesson-plans/lesson-plans.service';
import { PrismaLessonPlanRepository } from './lesson-plans/prisma-lesson-plan.repository';
import { LessonPlanResourcesAuditSnapshot } from './lesson-plans/resources/lesson-plan-resources.audit-snapshot';
import { LessonPlanResourcesController } from './lesson-plans/resources/lesson-plan-resources.controller';
import { LessonPlanResourcesService } from './lesson-plans/resources/lesson-plan-resources.service';
import { LESSON_PLAN_RESOURCE_REPOSITORY } from './lesson-plans/resources/lesson-plan-resource.repository';
import { PrismaLessonPlanResourceRepository } from './lesson-plans/resources/prisma-lesson-plan-resource.repository';
import { PrismaReviewRepository } from './review/prisma-review.repository';
import { REVIEW_REPOSITORY } from './review/review.repository';
import { ReviewsService } from './review/reviews.service';

/**
 * Planeación: planeaciones, recursos digitales y revisión de coordinación. Exporta
 * `ReviewsService` para que BE-6 (diario y observador) reutilice la revisión.
 */
@Module({
  imports: [DatabaseModule, StructureModule],
  controllers: [LessonPlansController, LessonPlanReviewController, LessonPlanResourcesController],
  providers: [
    ReviewsService,
    { provide: REVIEW_REPOSITORY, useClass: PrismaReviewRepository },
    LessonPlansService,
    LessonPlanAuditSnapshot,
    { provide: LESSON_PLAN_REPOSITORY, useClass: PrismaLessonPlanRepository },
    LessonPlanResourcesService,
    LessonPlanResourcesAuditSnapshot,
    { provide: LESSON_PLAN_RESOURCE_REPOSITORY, useClass: PrismaLessonPlanResourceRepository },
  ],
  exports: [ReviewsService],
})
export class PlanningModule {}
