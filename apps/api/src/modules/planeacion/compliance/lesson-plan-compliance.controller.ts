import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { RequireRole } from '../../identidad/auth/access.decorators';
import {
  LessonPlanComplianceDto,
  LessonPlanComplianceQueryDto,
} from './dto/lesson-plan-compliance.dto';
import { LessonPlanComplianceService } from './lesson-plan-compliance.service';

/** Informe de solo lectura para coordinación (y administración); sin bitácora. */
@Controller('lesson-plan-compliance')
@RequireRole(UserRole.Coordinator)
export class LessonPlanComplianceController {
  constructor(private readonly compliance: LessonPlanComplianceService) {}

  @Get()
  @ZodResponse({ status: 200, type: LessonPlanComplianceDto })
  get(@Query() query: LessonPlanComplianceQueryDto) {
    return this.compliance.get(query);
  }
}
