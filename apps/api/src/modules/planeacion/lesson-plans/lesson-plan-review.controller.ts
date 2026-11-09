import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import {
  ApproveLessonPlanDto,
  LessonPlanDto,
  ReturnLessonPlanDto,
  ReviewListDto,
} from './dto/lesson-plan.dto';
import { LESSON_PLAN_AUDIT } from './lesson-plan.audit-snapshot';
import { LessonPlansService } from './lesson-plans.service';

/**
 * Revisión de coordinación de las planeaciones: la revisión es genérica (`ReviewsService`);
 * estas rutas son propias del tipo de registro. Aprobar y devolver admiten ajustes de
 * contenido opcionales (`changes`), que se aplican en la misma operación.
 */
@Controller('lesson-plans')
@RequireRole(UserRole.Coordinator)
export class LessonPlanReviewController {
  constructor(private readonly lessonPlans: LessonPlansService) {}

  @Post(':id/approve')
  @HttpCode(200)
  @Audited({ ...LESSON_PLAN_AUDIT, action: 'Aprobó una planeación' })
  @ZodResponse({ status: 200, type: LessonPlanDto })
  approve(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() body: ApproveLessonPlanDto,
  ) {
    return this.lessonPlans.approve(user, id, body);
  }

  @Post(':id/return')
  @HttpCode(200)
  @Audited({ ...LESSON_PLAN_AUDIT, action: 'Devolvió una planeación con observaciones' })
  @ZodResponse({ status: 200, type: LessonPlanDto })
  returnPlan(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() body: ReturnLessonPlanDto,
  ) {
    return this.lessonPlans.returnPlan(user, id, body);
  }

  /** El dueño también ve su historial: el rol mínimo es docente y el servicio decide la visibilidad. */
  @Get(':id/reviews')
  @RequireRole(UserRole.Teacher)
  @ZodResponse({ status: 200, type: ReviewListDto })
  history(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.lessonPlans.history(user, id);
  }
}
