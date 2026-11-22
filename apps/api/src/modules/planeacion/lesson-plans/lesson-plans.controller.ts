import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ALL_ROLES, UserRole } from '@gns/shared';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { Roles } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import {
  CreateLessonPlanDto,
  LessonPlanDto,
  LessonPlanListQueryDto,
  LessonPlanOptionsDto,
  LessonPlanPageDto,
  UpdateLessonPlanDto,
  VoidLessonPlanDto,
} from './dto/lesson-plan.dto';
import { LESSON_PLAN_AUDIT, LessonPlanDiscardSnapshot } from './lesson-plan.audit-snapshot';
import { LessonPlansService } from './lesson-plans.service';

/**
 * Planeaciones del docente. Los roles se declaran en cada ruta; dueño y estado los decide el servicio
 * (un docente ve solo las suyas; coordinación, todas). Las transiciones son rutas de acción
 * y no un `PATCH` del estado: cada una tiene su cuerpo, su rol y su texto de bitácora.
 */
@Controller('lesson-plans')
export class LessonPlansController {
  constructor(private readonly lessonPlans: LessonPlansService) {}

  @Get()
  @Roles(...ALL_ROLES)
  @ZodResponse({ status: 200, type: LessonPlanPageDto })
  list(@CurrentUser() user: RequestUser, @Query() query: LessonPlanListQueryDto) {
    return this.lessonPlans.list(user, query);
  }

  /** Declarada antes de `:id`, que de lo contrario la tomaría como un id. */
  @Get('options')
  @Roles(UserRole.Teacher)
  @ZodResponse({ status: 200, type: LessonPlanOptionsDto })
  options(@CurrentUser() user: RequestUser) {
    return this.lessonPlans.options(user);
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  @ZodResponse({ status: 200, type: LessonPlanDto })
  get(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.lessonPlans.get(user, id);
  }

  @Post()
  @Roles(UserRole.Teacher)
  @Audited({ ...LESSON_PLAN_AUDIT, action: 'Creó una planeación' })
  @ZodResponse({ status: 201, type: LessonPlanDto })
  create(@CurrentUser() user: RequestUser, @Body() body: CreateLessonPlanDto) {
    return this.lessonPlans.create(user, body);
  }

  @Patch(':id')
  @Roles(UserRole.Teacher)
  @Audited({ ...LESSON_PLAN_AUDIT, action: 'Editó una planeación' })
  @ZodResponse({ status: 200, type: LessonPlanDto })
  update(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() body: UpdateLessonPlanDto,
  ) {
    return this.lessonPlans.update(user, id, body);
  }

  @Post(':id/submit')
  @Roles(UserRole.Teacher)
  @HttpCode(200)
  @Audited({ ...LESSON_PLAN_AUDIT, action: 'Envió una planeación a coordinación' })
  @ZodResponse({ status: 200, type: LessonPlanDto })
  submit(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.lessonPlans.submit(user, id);
  }

  @Post(':id/void')
  @Roles(UserRole.Teacher, UserRole.Coordinator)
  @HttpCode(200)
  @Audited({ ...LESSON_PLAN_AUDIT, action: 'Anuló una planeación', detailFromBody: 'reason' })
  @ZodResponse({ status: 200, type: LessonPlanDto })
  voidPlan(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- solo valida el motivo; la bitácora lo toma del cuerpo (`detailFromBody`)
    @Body() _body: VoidLessonPlanDto,
  ) {
    return this.lessonPlans.voidPlan(user, id);
  }

  /** Borrado real de un borrador propio que nunca se envió; lo enviado solo se anula. */
  @Delete(':id')
  @Roles(UserRole.Teacher)
  @HttpCode(204)
  @Audited({
    type: LESSON_PLAN_AUDIT.type,
    entity: LESSON_PLAN_AUDIT.entity,
    snapshot: LessonPlanDiscardSnapshot,
    action: 'Descartó un borrador',
  })
  @ApiNoContentResponse({ description: 'Borrador descartado' })
  discard(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.lessonPlans.discard(user, id);
  }
}
