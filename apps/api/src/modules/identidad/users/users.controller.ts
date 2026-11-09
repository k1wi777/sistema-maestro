import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireRole } from '../auth/require-role.decorator';
import {
  CreateUserDto,
  ResetPasswordDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  UserDto,
  UserListQueryDto,
  UserPageDto,
} from './dto/user.dto';
import { UserAuditSnapshot } from './user.audit-snapshot';
import { UsersService } from './users.service';

// El administrador es parte de coordinación: no se añade un tipo nuevo al CHECK de la bitácora.
const AUDIT = { type: AuditLogType.Coordination, entity: 'usuario', snapshot: UserAuditSnapshot };

@Controller('users')
@RequireRole(UserRole.Administrator)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ZodResponse({ status: 200, type: UserPageDto })
  list(@Query() query: UserListQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: UserDto })
  get(@Param() { id }: IdParamDto) {
    return this.users.get(id);
  }

  @Post()
  @Audited({ ...AUDIT, action: 'Crear usuario' })
  @ZodResponse({ status: 201, type: UserDto })
  create(@Body() body: CreateUserDto, @CurrentUser() actor: RequestUser) {
    return this.users.create(body, actor);
  }

  @Patch(':id')
  @Audited({ ...AUDIT, action: 'Editar usuario' })
  @ZodResponse({ status: 200, type: UserDto })
  update(
    @Param() { id }: IdParamDto,
    @Body() body: UpdateUserDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.update(id, body, actor);
  }

  @Patch(':id/status')
  @Audited({ ...AUDIT, action: 'Cambiar el estado de un usuario' })
  @ZodResponse({ status: 200, type: UserDto })
  setStatus(
    @Param() { id }: IdParamDto,
    @Body() { status }: UpdateUserStatusDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.setStatus(id, status, actor);
  }

  @Put(':id/password')
  @HttpCode(204)
  @Audited({
    ...AUDIT,
    action: 'Restablecer la contraseña de un usuario',
    detail: 'Contraseña restablecida',
  })
  @ApiNoContentResponse({ description: 'Contraseña restablecida y sesiones revocadas' })
  async resetPassword(
    @Param() { id }: IdParamDto,
    @Body() { password }: ResetPasswordDto,
  ): Promise<void> {
    await this.users.resetPassword(id, password);
  }
}
