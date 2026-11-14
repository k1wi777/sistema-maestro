import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import type { RequestUser } from '../../../core/audit/request-user';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import {
  PlanTrackingDto,
  TeacherTrackingDto,
  TrackingPlanParamsDto,
  TrackingTeacherParamsDto,
} from '../dto/training.dto';
import { TrainingTrackingService } from './training-tracking.service';

/** Seguimiento de la formación (coordinación): lecturas, sin bitácora. */
@Controller('training-tracking')
@RequireRole(UserRole.Coordinator)
export class TrainingTrackingController {
  constructor(private readonly tracking: TrainingTrackingService) {}

  @Get('plans/:planId')
  @ZodResponse({ status: 200, type: PlanTrackingDto })
  plan(@Param() { planId }: TrackingPlanParamsDto) {
    return this.tracking.forPlan(planId);
  }

  /** UTF-8 con BOM y `;`. La bitácora la escribe el servicio: lleva el plan y el número de filas. */
  @Get('plans/:planId/export')
  @ApiOkResponse({
    description: 'CSV del seguimiento: UTF-8 con BOM y separador `;`.',
    content: { 'text/csv': { schema: { type: 'string' } } },
  })
  async export(@CurrentUser() user: RequestUser, @Param() { planId }: TrackingPlanParamsDto) {
    const { fileName, content } = await this.tracking.exportPlan(user, planId);
    return new StreamableFile(Buffer.from(content, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Get('teachers/:teacherId')
  @ZodResponse({ status: 200, type: TeacherTrackingDto })
  teacher(@Param() { teacherId }: TrackingTeacherParamsDto) {
    return this.tracking.forTeacher(teacherId);
  }
}
