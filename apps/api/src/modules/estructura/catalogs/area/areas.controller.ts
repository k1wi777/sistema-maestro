import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../../core/audit/audited.decorator';
import { IdParamDto } from '../../../../shared/http/id-param.dto';
import { RequireRole } from '../../../identidad/auth/access.decorators';
import { AreaAuditSnapshot } from './area.audit-snapshot';
import { AreasService } from './areas.service';
import {
  AreaDto,
  AreaListQueryDto,
  AreaPageDto,
  CreateAreaDto,
  UpdateAreaDto,
} from './dto/area.dto';

const AUDIT = { type: AuditLogType.Coordination, entity: 'area', snapshot: AreaAuditSnapshot };

@Controller('areas')
export class AreasController {
  constructor(private readonly areas: AreasService) {}

  @Get()
  @RequireRole(UserRole.Teacher)
  @ZodResponse({ status: 200, type: AreaPageDto })
  list(@Query() query: AreaListQueryDto) {
    return this.areas.list(query);
  }

  @Post()
  @RequireRole(UserRole.Administrator)
  @Audited({ ...AUDIT, action: 'Crear área' })
  @ZodResponse({ status: 201, type: AreaDto })
  create(@Body() body: CreateAreaDto) {
    return this.areas.create(body);
  }

  @Patch(':id')
  @RequireRole(UserRole.Administrator)
  @Audited({ ...AUDIT, action: 'Editar área' })
  @ZodResponse({ status: 200, type: AreaDto })
  update(@Param() { id }: IdParamDto, @Body() body: UpdateAreaDto) {
    return this.areas.update(id, body);
  }
}
