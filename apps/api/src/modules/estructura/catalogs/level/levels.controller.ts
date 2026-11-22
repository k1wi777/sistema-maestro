import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ALL_ROLES, AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../../core/audit/audited.decorator';
import { IdParamDto } from '../../../../shared/http/id-param.dto';
import { Roles } from '../../../identidad/auth/access.decorators';
import {
  CreateLevelDto,
  LevelDto,
  LevelListQueryDto,
  LevelPageDto,
  UpdateLevelDto,
} from './dto/level.dto';
import { LevelAuditSnapshot } from './level.audit-snapshot';
import { LevelsService } from './levels.service';

const AUDIT = { type: AuditLogType.Coordination, entity: 'nivel', snapshot: LevelAuditSnapshot };

@Controller('levels')
export class LevelsController {
  constructor(private readonly levels: LevelsService) {}

  @Get()
  @Roles(...ALL_ROLES)
  @ZodResponse({ status: 200, type: LevelPageDto })
  list(@Query() query: LevelListQueryDto) {
    return this.levels.list(query);
  }

  @Post()
  @Roles(UserRole.Administrator)
  @Audited({ ...AUDIT, action: 'Crear nivel' })
  @ZodResponse({ status: 201, type: LevelDto })
  create(@Body() body: CreateLevelDto) {
    return this.levels.create(body);
  }

  @Patch(':id')
  @Roles(UserRole.Administrator)
  @Audited({ ...AUDIT, action: 'Editar nivel' })
  @ZodResponse({ status: 200, type: LevelDto })
  update(@Param() { id }: IdParamDto, @Body() body: UpdateLevelDto) {
    return this.levels.update(id, body);
  }
}
