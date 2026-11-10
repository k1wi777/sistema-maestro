import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import {
  CreateTrainingModuleDto,
  CreateTrainingPlanDto,
  CreateTrainingSectionDto,
  OrderDto,
  TrainingModuleDto,
  TrainingPlanDto,
  TrainingPlanListDto,
  TrainingPlanTreeDto,
  TrainingSectionDto,
  TrainingSectionWithModulesDto,
  UpdateTrainingPlanDto,
  UpdateTrainingSectionDto,
} from '../dto/training.dto';
import {
  TrainingPlanAuditSnapshot,
  TrainingSectionAuditSnapshot,
} from '../training.audit-snapshot';
import { TrainingPlansService } from './training-plans.service';

const PLAN_AUDIT = {
  type: AuditLogType.Training,
  entity: 'plan_formacion',
  snapshot: TrainingPlanAuditSnapshot,
};
const SECTION_AUDIT = {
  type: AuditLogType.Training,
  entity: 'seccion_plan',
  snapshot: TrainingSectionAuditSnapshot,
};

/** Planes de formación y sus secciones (coordinación; administración hereda por jerarquía). */
@Controller('training-plans')
@RequireRole(UserRole.Coordinator)
export class TrainingPlansController {
  constructor(private readonly plans: TrainingPlansService) {}

  @Get()
  @ZodResponse({ status: 200, type: TrainingPlanListDto })
  list() {
    return this.plans.listPlans();
  }

  @Post()
  @Audited({ ...PLAN_AUDIT, action: 'Creó un plan de formación' })
  @ZodResponse({ status: 201, type: TrainingPlanDto })
  create(@Body() body: CreateTrainingPlanDto) {
    return this.plans.createPlan(body);
  }

  @Patch(':id')
  @Audited({ ...PLAN_AUDIT, action: 'Editó un plan de formación' })
  @ZodResponse({ status: 200, type: TrainingPlanDto })
  update(@Param() { id }: IdParamDto, @Body() body: UpdateTrainingPlanDto) {
    return this.plans.updatePlan(id, body);
  }

  @Get(':id/sections')
  @ZodResponse({ status: 200, type: TrainingPlanTreeDto })
  tree(@Param() { id }: IdParamDto) {
    return this.plans.tree(id);
  }

  @Post(':id/sections')
  @Audited({ ...PLAN_AUDIT, action: 'Creó una sección de un plan de formación' })
  @ZodResponse({ status: 201, type: TrainingSectionDto })
  createSection(@Param() { id }: IdParamDto, @Body() body: CreateTrainingSectionDto) {
    return this.plans.createSection(id, body);
  }

  @Put(':id/section-order')
  @Audited({ ...PLAN_AUDIT, action: 'Reordenó las secciones de un plan de formación' })
  @ZodResponse({ status: 200, type: TrainingPlanTreeDto })
  setSectionOrder(@Param() { id }: IdParamDto, @Body() body: OrderDto) {
    return this.plans.setSectionOrder(id, body.ids);
  }
}

/** Secciones de un plan y los módulos que contienen. */
@Controller('training-sections')
@RequireRole(UserRole.Coordinator)
export class TrainingSectionsController {
  constructor(private readonly plans: TrainingPlansService) {}

  @Patch(':id')
  @Audited({ ...SECTION_AUDIT, action: 'Editó una sección de un plan de formación' })
  @ZodResponse({ status: 200, type: TrainingSectionDto })
  update(@Param() { id }: IdParamDto, @Body() body: UpdateTrainingSectionDto) {
    return this.plans.updateSection(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Audited({ ...SECTION_AUDIT, action: 'Quitó una sección vacía de un plan de formación' })
  remove(@Param() { id }: IdParamDto) {
    return this.plans.deleteSection(id);
  }

  @Post(':id/modules')
  @Audited({ ...SECTION_AUDIT, action: 'Creó un módulo de formación en borrador' })
  @ZodResponse({ status: 201, type: TrainingModuleDto })
  createModule(@Param() { id }: IdParamDto, @Body() body: CreateTrainingModuleDto) {
    return this.plans.createModule(id, body);
  }

  @Put(':id/module-order')
  @Audited({ ...SECTION_AUDIT, action: 'Reordenó los módulos de una sección' })
  @ZodResponse({ status: 200, type: TrainingSectionWithModulesDto })
  setModuleOrder(@Param() { id }: IdParamDto, @Body() body: OrderDto) {
    return this.plans.setModuleOrder(id, body.ids);
  }
}
