import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import type { RequestUser } from '../../../core/audit/request-user';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CurrentUser } from '../../identidad/auth/current-user.decorator';
import { MyAssignmentsDto } from './dto/teacher-assignment.dto';
import { TeacherAssignmentsService } from './teacher-assignments.service';

// Controlador propio: separa el rol mínimo (docente) del de `/teacher-assignments` (coordinador)
// y evita que un futuro `GET /teacher-assignments/:id` capture `mine`.
@Controller('me')
export class MyAssignmentsController {
  constructor(private readonly assignments: TeacherAssignmentsService) {}

  @Get('assignments')
  @RequireRole(UserRole.Teacher)
  @ZodResponse({ status: 200, type: MyAssignmentsDto })
  mine(@CurrentUser() user: RequestUser) {
    return this.assignments.listMine(user.id);
  }
}
