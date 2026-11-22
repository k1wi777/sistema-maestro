import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { ALL_ROLES, AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../../core/audit/audited.decorator';
import { IdParamDto } from '../../../../shared/http/id-param.dto';
import { Roles } from '../../../identidad/auth/access.decorators';
import { AreaAuditSnapshot } from './area.audit-snapshot';
import { AreasService } from './areas.service';
import {
  AreaDto,
  AreaListQueryDto,
  AreaPageDto,
  CreateAreaDto,
  UpdateAreaDto,
} from './dto/area.dto';

const AUDIT = { type: AuditLogType.Structure, entity: 'area', snapshot: AreaAuditSnapshot };

@Controller('areas')
export class AreasController {
  constructor(private readonly areas: AreasService) {}

  @Get()
  @Roles(...ALL_ROLES)
  @ZodResponse({ status: 200, type: AreaPageDto })
  list(@Query() query: AreaListQueryDto) {
    return this.areas.list(query);
  }

  @Post()
  @Roles(UserRole.Administrator)
  @Audited({ ...AUDIT, action: 'Crear área' })
  @ZodResponse({ status: 201, type: AreaDto })
  create(@Body() body: CreateAreaDto) {
    return this.areas.create(body);
  }

  @Patch(':id')
  @Roles(UserRole.Administrator)
  @Audited({ ...AUDIT, action: 'Editar área' })
  @ZodResponse({ status: 200, type: AreaDto })
  update(@Param() { id }: IdParamDto, @Body() body: UpdateAreaDto) {
    return this.areas.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Borrado' })
  @Roles(UserRole.Administrator)
  @Audited({ ...AUDIT, action: 'Borrar área' })
  remove(@Param() { id }: IdParamDto) {
    return this.areas.remove(id);
  }
}
