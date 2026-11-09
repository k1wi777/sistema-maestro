import { Inject, Injectable } from '@nestjs/common';
import {
  LESSON_PLAN_DELIVERED_STATUSES,
  MAX_PAGE_SIZE,
  type LessonPlanCompliance,
  type LessonPlanComplianceQuery,
} from '@gns/shared';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import { TeacherAssignmentsService } from '../../estructura/assignments/teacher-assignments.service';
import { AcademicPeriodsService } from '../../estructura/catalogs/academic-period/academic-periods.service';
import { SchoolYearsService } from '../../estructura/school-years/school-years.service';
import {
  LESSON_PLAN_REPOSITORY,
  type LessonPlanRepository,
} from '../lesson-plans/lesson-plan.repository';
import { buildCompliance } from './build-compliance';

/**
 * Cumplimiento de entregas del año vigente: asignaciones activas contra planeaciones
 * entregadas por periodo. Tres lecturas acotadas y un cruce en memoria; el cruce no se hace
 * en SQL desde `planeacion` porque saltaría el servicio exportado de `estructura`.
 */
@Injectable()
export class LessonPlanComplianceService {
  constructor(
    @Inject(LESSON_PLAN_REPOSITORY) private readonly lessonPlans: LessonPlanRepository,
    private readonly assignments: TeacherAssignmentsService,
    private readonly periods: AcademicPeriodsService,
    private readonly schoolYears: SchoolYearsService,
  ) {}

  async get(query: LessonPlanComplianceQuery): Promise<LessonPlanCompliance> {
    const { code: schoolYear } = await this.schoolYears.requireCurrent();

    if (query.periodId) {
      const period = await this.periods.find(query.periodId);
      if (!period || period.schoolYear !== schoolYear) {
        throw new RequestValidationException([
          {
            field: 'periodId',
            reason: `debe ser un periodo del año lectivo vigente (${schoolYear})`,
          },
        ]);
      }
    }

    // Un año tiene como máximo 3 periodos: una sola página los trae todos.
    const yearPeriods = await this.periods.list({
      page: 1,
      pageSize: MAX_PAGE_SIZE,
      sort: { field: 'number', order: 'asc' },
      filters: { schoolYear },
    });
    const periods = yearPeriods.items.filter(
      (period) => !query.periodId || period.id === query.periodId,
    );

    const assignments = (await this.assignments.listActive(schoolYear)).filter(
      (assignment) => !query.teacherId || assignment.teacher.id === query.teacherId,
    );
    const delivered = await this.lessonPlans.countDelivered({
      schoolYear,
      statuses: LESSON_PLAN_DELIVERED_STATUSES,
      teacherId: query.teacherId,
      periodId: query.periodId,
    });

    return {
      schoolYear,
      periods: periods.map(({ id, number, startDate, endDate }) => ({
        id,
        number,
        startDate,
        endDate,
      })),
      teachers: buildCompliance(periods, assignments, delivered),
    };
  }
}
