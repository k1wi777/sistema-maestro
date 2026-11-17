import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../../core/audit/audited.decorator';
import { IdParamDto } from '../../../../shared/http/id-param.dto';
import { RequireRole } from '../../../identidad/auth/access.decorators';
import {
  CreateGradeDto,
  GradeDto,
  GradeListQueryDto,
  GradePageDto,
  UpdateGradeDto,
} from './dto/grade.dto';
import { GradeAuditSnapshot } from './grade.audit-snapshot';
import { GradesService } from './grades.service';

const AUDIT = { type: AuditLogType.Structure, entity: 'grado', snapshot: GradeAuditSnapshot };

@Controller('grades')
export class GradesController {
  constructor(private readonly grades: GradesService) {}

  @Get()
  @RequireRole(UserRole.Teacher)
  @ZodResponse({ status: 200, type: GradePageDto })
  list(@Query() query: GradeListQueryDto) {
    return this.grades.list(query);
  }

  @Post()
  @RequireRole(UserRole.Coordinator)
  @Audited({ ...AUDIT, action: 'Crear grado' })
  @ZodResponse({ status: 201, type: GradeDto })
  create(@Body() body: CreateGradeDto) {
    return this.grades.create(body);
  }

  // Activar o desactivar va aquí con `{ active }`: el antes y después de la bitácora muestra el cambio.
  @Patch(':id')
  @RequireRole(UserRole.Coordinator)
  @Audited({ ...AUDIT, action: 'Editar grado' })
  @ZodResponse({ status: 200, type: GradeDto })
  update(@Param() { id }: IdParamDto, @Body() body: UpdateGradeDto) {
    return this.grades.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Borrado' })
  @RequireRole(UserRole.Coordinator)
  @Audited({ ...AUDIT, action: 'Borrar grado' })
  remove(@Param() { id }: IdParamDto) {
    return this.grades.remove(id);
  }
}
