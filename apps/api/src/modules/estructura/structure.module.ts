import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { IdentityModule } from '../identidad/identity.module';
import { MyAssignmentsController } from './assignments/my-assignments.controller';
import { PrismaTeacherAssignmentRepository } from './assignments/prisma-teacher-assignment.repository';
import { TeacherAssignmentAuditSnapshot } from './assignments/teacher-assignment.audit-snapshot';
import { TEACHER_ASSIGNMENT_REPOSITORY } from './assignments/teacher-assignment.repository';
import { TeacherAssignmentsController } from './assignments/teacher-assignments.controller';
import { TeacherAssignmentsService } from './assignments/teacher-assignments.service';
import { AcademicPeriodAuditSnapshot } from './catalogs/academic-period/academic-period.audit-snapshot';
import { ACADEMIC_PERIOD_REPOSITORY } from './catalogs/academic-period/academic-period.repository';
import { AcademicPeriodsController } from './catalogs/academic-period/academic-periods.controller';
import { AcademicPeriodsService } from './catalogs/academic-period/academic-periods.service';
import { PrismaAcademicPeriodRepository } from './catalogs/academic-period/prisma-academic-period.repository';
import { AreaAuditSnapshot } from './catalogs/area/area.audit-snapshot';
import { AREA_REPOSITORY } from './catalogs/area/area.repository';
import { AreasController } from './catalogs/area/areas.controller';
import { AreasService } from './catalogs/area/areas.service';
import { PrismaAreaRepository } from './catalogs/area/prisma-area.repository';
import { GradeAuditSnapshot } from './catalogs/grade/grade.audit-snapshot';
import { GRADE_REPOSITORY } from './catalogs/grade/grade.repository';
import { GradesController } from './catalogs/grade/grades.controller';
import { GradesService } from './catalogs/grade/grades.service';
import { PrismaGradeRepository } from './catalogs/grade/prisma-grade.repository';
import { LevelAuditSnapshot } from './catalogs/level/level.audit-snapshot';
import { LEVEL_REPOSITORY } from './catalogs/level/level.repository';
import { LevelsController } from './catalogs/level/levels.controller';
import { LevelsService } from './catalogs/level/levels.service';
import { PrismaLevelRepository } from './catalogs/level/prisma-level.repository';
import { PrismaSchoolYearRepository } from './school-years/prisma-school-year.repository';
import { SchoolYearAuditSnapshot } from './school-years/school-year.audit-snapshot';
import { SCHOOL_YEAR_REPOSITORY } from './school-years/school-year.repository';
import { SchoolYearsController } from './school-years/school-years.controller';
import { SchoolYearsService } from './school-years/school-years.service';

/**
 * Estructura académica: catálogos (niveles, grados, áreas y periodos), años lectivos y
 * asignaciones docentes. Usa `UsersService` (exportado por identidad) para validar al docente.
 */
@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [
    LevelsController,
    GradesController,
    AreasController,
    AcademicPeriodsController,
    SchoolYearsController,
    TeacherAssignmentsController,
    MyAssignmentsController,
  ],
  providers: [
    LevelsService,
    LevelAuditSnapshot,
    { provide: LEVEL_REPOSITORY, useClass: PrismaLevelRepository },
    GradesService,
    GradeAuditSnapshot,
    { provide: GRADE_REPOSITORY, useClass: PrismaGradeRepository },
    AreasService,
    AreaAuditSnapshot,
    { provide: AREA_REPOSITORY, useClass: PrismaAreaRepository },
    AcademicPeriodsService,
    AcademicPeriodAuditSnapshot,
    { provide: ACADEMIC_PERIOD_REPOSITORY, useClass: PrismaAcademicPeriodRepository },
    SchoolYearsService,
    SchoolYearAuditSnapshot,
    { provide: SCHOOL_YEAR_REPOSITORY, useClass: PrismaSchoolYearRepository },
    TeacherAssignmentsService,
    TeacherAssignmentAuditSnapshot,
    { provide: TEACHER_ASSIGNMENT_REPOSITORY, useClass: PrismaTeacherAssignmentRepository },
  ],
  // BE-5 a BE-7 consultan el año vigente, las asignaciones, los periodos y los catálogos por sus servicios.
  exports: [
    SchoolYearsService,
    TeacherAssignmentsService,
    AcademicPeriodsService,
    LevelsService,
    AreasService,
  ],
})
export class StructureModule {}
