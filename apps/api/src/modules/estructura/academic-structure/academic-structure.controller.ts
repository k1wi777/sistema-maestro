import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { AuditLogType, UserRole } from '@gns/shared';
import { ZodResponse } from 'nestjs-zod';
import { Audited } from '../../../core/audit/audited.decorator';
import { IdParamDto } from '../../../shared/http/id-param.dto';
import { RequireRole } from '../../identidad/auth/access.decorators';
import { CoordinatorGradesAuditSnapshot } from '../catalogs/grade/coordinator-grades.audit-snapshot';
import { GradesService } from '../catalogs/grade/grades.service';
import { AcademicStructureService } from './academic-structure.service';
import {
  AcademicStructureDto,
  CoordinatorGradesDto,
  SetCoordinatorGradesDto,
} from './dto/academic-structure.dto';

@Controller()
@RequireRole(UserRole.Coordinator)
export class AcademicStructureController {
  constructor(
    private readonly structure: AcademicStructureService,
    private readonly grades: GradesService,
  ) {}

  @Get('academic-structure')
  @ZodResponse({ status: 200, type: AcademicStructureDto })
  read() {
    return this.structure.read();
  }

  @Put('coordinators/:id/grades')
  @Audited({
    type: AuditLogType.Structure,
    entity: 'coordinacion_grado',
    snapshot: CoordinatorGradesAuditSnapshot,
    action: 'Cambiar los grados de una coordinadora',
  })
  @ZodResponse({ status: 200, type: CoordinatorGradesDto })
  setGrades(@Param() { id }: IdParamDto, @Body() body: SetCoordinatorGradesDto) {
    return this.grades.setCoordinatorGrades(id, body.gradeIds);
  }
}
