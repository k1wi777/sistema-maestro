import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../../core/audit/request-user';
import { IdParamDto } from '../../../../shared/http/id-param.dto';
import { RequireRole } from '../../../identidad/auth/access.decorators';
import { CurrentUser } from '../../../identidad/auth/current-user.decorator';
import {
  CreateLessonPlanResourceDto,
  LessonPlanResourceDto,
  LessonPlanResourceParamsDto,
} from './dto/lesson-plan-resource.dto';
import { LessonPlanResourcesAuditSnapshot } from './lesson-plan-resources.audit-snapshot';
import { LessonPlanResourcesService } from './lesson-plan-resources.service';

const AUDIT = {
  type: AuditLogType.LessonPlan,
  entity: 'planeacion',
  snapshot: LessonPlanResourcesAuditSnapshot,
};

@Controller('lesson-plans/:id/resources')
@RequireRole(UserRole.Teacher)
export class LessonPlanResourcesController {
  constructor(private readonly resources: LessonPlanResourcesService) {}

  @Post()
  @Audited({ ...AUDIT, action: 'Agregó un recurso digital a una planeación' })
  @ZodResponse({ status: 201, type: LessonPlanResourceDto })
  add(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() body: CreateLessonPlanResourceDto,
  ) {
    return this.resources.add(user, id, body);
  }

  @Delete(':resourceId')
  @HttpCode(204)
  @Audited({ ...AUDIT, action: 'Quitó un recurso digital de una planeación' })
  remove(
    @CurrentUser() user: RequestUser,
    @Param() { id, resourceId }: LessonPlanResourceParamsDto,
  ) {
    return this.resources.remove(user, id, resourceId);
  }
}
