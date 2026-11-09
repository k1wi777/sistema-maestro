import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../../core/audit/audited.decorator';
import { IdParamDto } from '../../../../shared/http/id-param.dto';
import { RequireRole } from '../../../identidad/auth/access.decorators';
import { AcademicPeriodAuditSnapshot } from './academic-period.audit-snapshot';
import { AcademicPeriodsService } from './academic-periods.service';
import {
  AcademicPeriodDto,
  AcademicPeriodListQueryDto,
  AcademicPeriodPageDto,
  CreateAcademicPeriodDto,
  UpdateAcademicPeriodDto,
} from './dto/academic-period.dto';

const AUDIT = {
  type: AuditLogType.Coordination,
  entity: 'periodo_academico',
  snapshot: AcademicPeriodAuditSnapshot,
};

@Controller('academic-periods')
export class AcademicPeriodsController {
  constructor(private readonly periods: AcademicPeriodsService) {}

  @Get()
  @RequireRole(UserRole.Teacher)
  @ZodResponse({ status: 200, type: AcademicPeriodPageDto })
  list(@Query() query: AcademicPeriodListQueryDto) {
    return this.periods.list(query);
  }

  @Post()
  @RequireRole(UserRole.Administrator)
  @Audited({ ...AUDIT, action: 'Crear periodo académico' })
  @ZodResponse({ status: 201, type: AcademicPeriodDto })
  create(@Body() body: CreateAcademicPeriodDto) {
    return this.periods.create(body);
  }

  @Patch(':id')
  @RequireRole(UserRole.Administrator)
  @Audited({ ...AUDIT, action: 'Editar periodo académico' })
  @ZodResponse({ status: 200, type: AcademicPeriodDto })
  update(@Param() { id }: IdParamDto, @Body() body: UpdateAcademicPeriodDto) {
    return this.periods.update(id, body);
  }
}
