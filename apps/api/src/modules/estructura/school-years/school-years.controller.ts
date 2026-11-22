import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ALL_ROLES, AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { Roles } from '../../identidad/auth/access.decorators';
import {
  CreateSchoolYearDto,
  SchoolYearDto,
  SchoolYearListQueryDto,
  SchoolYearPageDto,
} from './dto/school-year.dto';
import { SchoolYearAuditSnapshot } from './school-year.audit-snapshot';
import { SchoolYearsService } from './school-years.service';

const AUDIT = {
  type: AuditLogType.Coordination,
  entity: 'anio_lectivo',
  snapshot: SchoolYearAuditSnapshot,
};

@Controller('school-years')
export class SchoolYearsController {
  constructor(private readonly schoolYears: SchoolYearsService) {}

  @Get()
  @Roles(...ALL_ROLES)
  @ZodResponse({ status: 200, type: SchoolYearPageDto })
  list(@Query() query: SchoolYearListQueryDto) {
    return this.schoolYears.list(query);
  }

  @Get('current')
  @Roles(...ALL_ROLES)
  @ZodResponse({ status: 200, type: SchoolYearDto })
  current() {
    return this.schoolYears.requireCurrent();
  }

  @Post()
  @Roles(UserRole.Administrator)
  @Audited({ ...AUDIT, action: 'Registrar año lectivo' })
  @ZodResponse({ status: 201, type: SchoolYearDto })
  create(@Body() body: CreateSchoolYearDto) {
    return this.schoolYears.create(body);
  }

  @Put(':id/current')
  @Roles(UserRole.Administrator)
  @Audited({ ...AUDIT, action: 'Marcar año lectivo vigente' })
  @ZodResponse({ status: 200, type: SchoolYearDto })
  setCurrent(@Param() { id }: IdParamDto) {
    return this.schoolYears.setCurrent(id);
  }
}
