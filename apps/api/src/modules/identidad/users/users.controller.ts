import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { Roles } from '../auth/access.decorators';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  ChangeUserRoleDto,
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

// «Usuarios y roles»: las filas anteriores a #115 de estas acciones quedaron como `coordinacion`.
const AUDIT = { type: AuditLogType.Users, entity: 'usuario', snapshot: UserAuditSnapshot };

@Controller('users')
@Roles(UserRole.Administrator)
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
  update(@Param() { id }: IdParamDto, @Body() body: UpdateUserDto) {
    return this.users.update(id, body);
  }

  @Put(':id/role')
  @Audited({ ...AUDIT, action: 'Cambió el rol' })
  @ZodResponse({ status: 200, type: UserDto })
  changeRole(
    @Param() { id }: IdParamDto,
    @Body() { role }: ChangeUserRoleDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.changeRole(id, role, actor);
  }

  @Patch(':id/status')
  @Audited({ ...AUDIT, action: 'Cambiar el estado de un usuario', detailFromBody: 'status' })
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
