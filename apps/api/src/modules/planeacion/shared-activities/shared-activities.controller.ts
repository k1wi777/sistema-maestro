import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import {
  CreateSharedActivityDto,
  SharedActivityDto,
  SharedActivityListQueryDto,
  SharedActivityPageDto,
  UpdateSharedActivityDto,
} from './dto/shared-activity.dto';
import { SHARED_ACTIVITY_AUDIT } from './shared-activity.audit-snapshot';
import { SharedActivitiesService } from './shared-activities.service';

/**
 * Repositorio de actividades de la comunidad. El rol mínimo es docente; la autoría la decide
 * el servicio (solo el autor edita y retira).
 */
@Controller('shared-activities')
@RequireRole(UserRole.Teacher)
export class SharedActivitiesController {
  constructor(private readonly activities: SharedActivitiesService) {}

  @Get()
  @ZodResponse({ status: 200, type: SharedActivityPageDto })
  list(@CurrentUser() user: RequestUser, @Query() query: SharedActivityListQueryDto) {
    return this.activities.list(user, query);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: SharedActivityDto })
  get(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.activities.get(user, id);
  }

  @Post()
  @Audited({ ...SHARED_ACTIVITY_AUDIT, action: 'Compartió una actividad del repositorio' })
  @ZodResponse({ status: 201, type: SharedActivityDto })
  create(@CurrentUser() user: RequestUser, @Body() body: CreateSharedActivityDto) {
    return this.activities.create(user, body);
  }

  @Patch(':id')
  @Audited({ ...SHARED_ACTIVITY_AUDIT, action: 'Editó una actividad del repositorio' })
  @ZodResponse({ status: 200, type: SharedActivityDto })
  update(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() body: UpdateSharedActivityDto,
  ) {
    return this.activities.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Audited({ ...SHARED_ACTIVITY_AUDIT, action: 'Retiró una actividad del repositorio' })
  remove(@CurrentUser() user: RequestUser, @Param() { id }: IdParamDto) {
    return this.activities.remove(user, id);
  }
}
