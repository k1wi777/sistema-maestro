import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import type { RequestUser } from '../../../core/audit/request-user';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { Roles } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import {
  CreateTeacherAssignmentDto,
  TeacherAssignmentDto,
  TeacherAssignmentListQueryDto,
  TeacherAssignmentPageDto,
  UpdateTeacherAssignmentDto,
  UpdateTeacherAssignmentStatusDto,
} from './dto/teacher-assignment.dto';
import { TeacherAssignmentAuditSnapshot } from './teacher-assignment.audit-snapshot';
import { TeacherAssignmentsService } from './teacher-assignments.service';

const AUDIT = {
  type: AuditLogType.Coordination,
  entity: 'asignacion_docente',
  snapshot: TeacherAssignmentAuditSnapshot,
};

@Controller('teacher-assignments')
@Roles(UserRole.Coordinator, UserRole.Administrator)
export class TeacherAssignmentsController {
  constructor(private readonly assignments: TeacherAssignmentsService) {}

  @Get()
  @ZodResponse({ status: 200, type: TeacherAssignmentPageDto })
  list(@Query() query: TeacherAssignmentListQueryDto) {
    return this.assignments.list(query);
  }

  @Post()
  @Audited({ ...AUDIT, action: 'Crear asignación docente' })
  @ZodResponse({ status: 201, type: TeacherAssignmentDto })
  create(@CurrentUser() user: RequestUser, @Body() body: CreateTeacherAssignmentDto) {
    return this.assignments.create(user, body);
  }

  @Patch(':id')
  @Audited({ ...AUDIT, action: 'Editar la dirección de grupo de una asignación docente' })
  @ZodResponse({ status: 200, type: TeacherAssignmentDto })
  update(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() body: UpdateTeacherAssignmentDto,
  ) {
    return this.assignments.update(user, id, body);
  }

  @Patch(':id/status')
  @Audited({ ...AUDIT, action: 'Cambiar el estado de una asignación docente' })
  @ZodResponse({ status: 200, type: TeacherAssignmentDto })
  setStatus(
    @CurrentUser() user: RequestUser,
    @Param() { id }: IdParamDto,
    @Body() { status }: UpdateTeacherAssignmentStatusDto,
  ) {
    return this.assignments.setStatus(user, id, status);
  }
}
