import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  LESSON_PLAN_MAX_RESOURCES,
  type CreateLessonPlanResourceInput,
  type LessonPlanResource,
} from '@gns/shared';
import type { RequestUser } from '../../../../core/audit/request-user';
import { LessonPlansService } from '../lesson-plans.service';
import {
  LESSON_PLAN_RESOURCE_REPOSITORY,
  type LessonPlanResourceRepository,
} from './lesson-plan-resource.repository';

/** Enlaces digitales de una planeación editable de su dueño; la regla de dueño y estado es la de `LessonPlansService`. */
@Injectable()
export class LessonPlanResourcesService {
  constructor(
    @Inject(LESSON_PLAN_RESOURCE_REPOSITORY)
    private readonly repository: LessonPlanResourceRepository,
    private readonly lessonPlans: LessonPlansService,
  ) {}

  async add(
    user: RequestUser,
    lessonPlanId: string,
    input: CreateLessonPlanResourceInput,
  ): Promise<LessonPlanResource> {
    await this.lessonPlans.requireEditable(user, lessonPlanId);
    // El tope se cuenta con la planeación bloqueada: dos altas simultáneas no lo superan.
    await this.lessonPlans.lock(lessonPlanId);
    await this.lessonPlans.requireEditable(user, lessonPlanId);
    if ((await this.repository.countByPlan(lessonPlanId)) >= LESSON_PLAN_MAX_RESOURCES) {
      throw new ConflictException(
        `Una planeación admite como máximo ${LESSON_PLAN_MAX_RESOURCES} enlaces digitales`,
      );
    }
    return this.repository.create(lessonPlanId, input);
  }

  async remove(user: RequestUser, lessonPlanId: string, resourceId: string): Promise<void> {
    await this.lessonPlans.requireEditable(user, lessonPlanId);
    // Con la planeación bloqueada se vuelve a comprobar el estado: una decisión concurrente gana.
    await this.lessonPlans.lock(lessonPlanId);
    await this.lessonPlans.requireEditable(user, lessonPlanId);
    if (!(await this.repository.findInPlan(lessonPlanId, resourceId))) {
      throw new NotFoundException('Enlace no encontrado en esta planeación');
    }
    await this.repository.delete(resourceId);
  }

  /** Enlaces de una planeación para la bitácora (`null` si la planeación no existe). */
  async listForAudit(lessonPlanId: string): Promise<LessonPlanResource[] | null> {
    if (!(await this.lessonPlans.findRaw(lessonPlanId))) {
      return null;
    }
    return this.repository.findByPlan(lessonPlanId);
  }
}
