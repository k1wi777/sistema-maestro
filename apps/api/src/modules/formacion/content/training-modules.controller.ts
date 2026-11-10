import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import {
  AuditLogType,
  challengeQuestionInputSchema,
  UserRole,
  type ChallengeQuestionInput,
} from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import { AppZodValidationPipe } from '../../../core/http/zod-validation.pipe';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { ZodRequestBody } from '../dto/zod-request-body';
import {
  ActivityDto,
  ActivityParamsDto,
  ChallengeQuestionDto,
  CreateActivityDto,
  CreateSlideDto,
  OrderDto,
  QuestionParamsDto,
  SlideDto,
  SlideParamsDto,
  TrainingModuleDetailDto,
  TrainingModuleDto,
  UpdateActivityDto,
  UpdateSlideDto,
  UpdateTrainingModuleDto,
} from '../dto/training.dto';
import { TrainingPlansService } from '../plans/training-plans.service';
import { TrainingModuleAuditSnapshot } from '../training.audit-snapshot';
import { TrainingContentService } from './training-content.service';

const AUDIT = {
  type: AuditLogType.Training,
  entity: 'modulo_formacion',
  snapshot: TrainingModuleAuditSnapshot,
};

/**
 * Módulos de formación y su contenido (coordinación). En las rutas anidadas `:id` es el módulo:
 * el interceptor audita el padre con un snapshot de sus diapositivas, preguntas y actividades.
 */
@Controller('training-modules')
@RequireRole(UserRole.Coordinator)
export class TrainingModulesController {
  constructor(
    private readonly plans: TrainingPlansService,
    private readonly content: TrainingContentService,
  ) {}

  @Get(':id')
  @ZodResponse({ status: 200, type: TrainingModuleDetailDto })
  detail(@Param() { id }: IdParamDto) {
    return this.content.getDetail(id);
  }

  @Patch(':id')
  @Audited({ ...AUDIT, action: 'Editó un módulo de formación' })
  @ZodResponse({ status: 200, type: TrainingModuleDto })
  update(@Param() { id }: IdParamDto, @Body() body: UpdateTrainingModuleDto) {
    return this.plans.updateModule(id, body);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @Audited({ ...AUDIT, action: 'Publicó un módulo de formación' })
  @ZodResponse({ status: 200, type: TrainingModuleDto })
  publish(@Param() { id }: IdParamDto) {
    return this.plans.changeStatus(id, 'publish');
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  @Audited({ ...AUDIT, action: 'Sacó un módulo de formación del plan' })
  @ZodResponse({ status: 200, type: TrainingModuleDto })
  withdraw(@Param() { id }: IdParamDto) {
    return this.plans.changeStatus(id, 'withdraw');
  }

  @Post(':id/restore')
  @HttpCode(200)
  @Audited({ ...AUDIT, action: 'Restauró un módulo de formación al plan' })
  @ZodResponse({ status: 200, type: TrainingModuleDto })
  restore(@Param() { id }: IdParamDto) {
    return this.plans.changeStatus(id, 'restore');
  }

  // ---------- Diapositivas ----------

  @Post(':id/slides')
  @Audited({ ...AUDIT, action: 'Agregó una diapositiva a un módulo de formación' })
  @ZodResponse({ status: 201, type: SlideDto })
  addSlide(@Param() { id }: IdParamDto, @Body() body: CreateSlideDto) {
    return this.content.addSlide(id, body);
  }

  @Patch(':id/slides/:slideId')
  @Audited({ ...AUDIT, action: 'Editó una diapositiva de un módulo de formación' })
  @ZodResponse({ status: 200, type: SlideDto })
  updateSlide(@Param() { id, slideId }: SlideParamsDto, @Body() body: UpdateSlideDto) {
    return this.content.updateSlide(id, slideId, body);
  }

  @Delete(':id/slides/:slideId')
  @HttpCode(204)
  @Audited({ ...AUDIT, action: 'Quitó una diapositiva de un módulo de formación' })
  removeSlide(@Param() { id, slideId }: SlideParamsDto) {
    return this.content.removeSlide(id, slideId);
  }

  @Put(':id/slide-order')
  @Audited({ ...AUDIT, action: 'Reordenó las diapositivas de un módulo de formación' })
  @ZodResponse({ status: 200, type: TrainingModuleDetailDto })
  setSlideOrder(@Param() { id }: IdParamDto, @Body() body: OrderDto) {
    return this.content.setSlideOrder(id, body.ids);
  }

  // ---------- Preguntas del Desafío ----------

  @Post(':id/questions')
  @ZodRequestBody(challengeQuestionInputSchema)
  @Audited({ ...AUDIT, action: 'Agregó una pregunta al Desafío de un módulo' })
  @ZodResponse({ status: 201, type: ChallengeQuestionDto })
  addQuestion(
    @Param() { id }: IdParamDto,
    @Body(new AppZodValidationPipe(challengeQuestionInputSchema)) body: ChallengeQuestionInput,
  ) {
    return this.content.addQuestion(id, body);
  }

  @Put(':id/questions/:questionId')
  @ZodRequestBody(challengeQuestionInputSchema)
  @Audited({ ...AUDIT, action: 'Reemplazó una pregunta del Desafío de un módulo' })
  @ZodResponse({ status: 200, type: ChallengeQuestionDto })
  replaceQuestion(
    @Param() { id, questionId }: QuestionParamsDto,
    @Body(new AppZodValidationPipe(challengeQuestionInputSchema)) body: ChallengeQuestionInput,
  ) {
    return this.content.replaceQuestion(id, questionId, body);
  }

  @Delete(':id/questions/:questionId')
  @HttpCode(204)
  @Audited({ ...AUDIT, action: 'Quitó una pregunta del Desafío de un módulo' })
  removeQuestion(@Param() { id, questionId }: QuestionParamsDto) {
    return this.content.removeQuestion(id, questionId);
  }

  @Put(':id/question-order')
  @Audited({ ...AUDIT, action: 'Reordenó las preguntas del Desafío de un módulo' })
  @ZodResponse({ status: 200, type: TrainingModuleDetailDto })
  setQuestionOrder(@Param() { id }: IdParamDto, @Body() body: OrderDto) {
    return this.content.setQuestionOrder(id, body.ids);
  }

  // ---------- Actividades ----------

  @Post(':id/activities')
  @Audited({ ...AUDIT, action: 'Agregó una actividad a un módulo de formación' })
  @ZodResponse({ status: 201, type: ActivityDto })
  addActivity(@Param() { id }: IdParamDto, @Body() body: CreateActivityDto) {
    return this.content.addActivity(id, body);
  }

  @Patch(':id/activities/:activityId')
  @Audited({ ...AUDIT, action: 'Editó una actividad de un módulo de formación' })
  @ZodResponse({ status: 200, type: ActivityDto })
  updateActivity(@Param() { id, activityId }: ActivityParamsDto, @Body() body: UpdateActivityDto) {
    return this.content.updateActivity(id, activityId, body);
  }

  @Post(':id/activities/:activityId/withdraw')
  @HttpCode(200)
  @Audited({ ...AUDIT, action: 'Sacó una actividad de un módulo de formación' })
  @ZodResponse({ status: 200, type: ActivityDto })
  withdrawActivity(@Param() { id, activityId }: ActivityParamsDto) {
    return this.content.withdrawActivity(id, activityId);
  }

  @Post(':id/activities/:activityId/restore')
  @HttpCode(200)
  @Audited({ ...AUDIT, action: 'Restauró una actividad de un módulo de formación' })
  @ZodResponse({ status: 200, type: ActivityDto })
  restoreActivity(@Param() { id, activityId }: ActivityParamsDto) {
    return this.content.restoreActivity(id, activityId);
  }

  @Put(':id/activity-order')
  @Audited({ ...AUDIT, action: 'Reordenó las actividades de un módulo de formación' })
  @ZodResponse({ status: 200, type: TrainingModuleDetailDto })
  setActivityOrder(@Param() { id }: IdParamDto, @Body() body: OrderDto) {
    return this.content.setActivityOrder(id, body.ids);
  }
}
