import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../../core/audit/audited.decorator';
import { IdParamDto } from '../../../../shared/http/id-param.dto';
import { RequireRole } from '../../../identidad/auth/access.decorators';
import {
  CreateGroupDto,
  GroupDto,
  GroupListQueryDto,
  GroupPageDto,
  UpdateGroupDto,
} from './dto/group.dto';
import { GroupAuditSnapshot } from './group.audit-snapshot';
import { GroupsService } from './groups.service';

const AUDIT = { type: AuditLogType.Structure, entity: 'grupo', snapshot: GroupAuditSnapshot };

@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @RequireRole(UserRole.Teacher)
  @ZodResponse({ status: 200, type: GroupPageDto })
  list(@Query() query: GroupListQueryDto) {
    return this.groups.list(query);
  }

  @Post()
  @RequireRole(UserRole.Coordinator)
  @Audited({ ...AUDIT, action: 'Crear grupo' })
  @ZodResponse({ status: 201, type: GroupDto })
  create(@Body() body: CreateGroupDto) {
    return this.groups.create(body);
  }

  @Patch(':id')
  @RequireRole(UserRole.Coordinator)
  @Audited({ ...AUDIT, action: 'Editar grupo' })
  @ZodResponse({ status: 200, type: GroupDto })
  update(@Param() { id }: IdParamDto, @Body() body: UpdateGroupDto) {
    return this.groups.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Borrado' })
  @RequireRole(UserRole.Coordinator)
  @Audited({ ...AUDIT, action: 'Borrar grupo' })
  remove(@Param() { id }: IdParamDto) {
    return this.groups.remove(id);
  }
}
