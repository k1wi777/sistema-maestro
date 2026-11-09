import { ConflictException } from '@nestjs/common';
import type { AcademicPeriod, SchoolYear } from '@gns/shared';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import type { TeacherAssignmentsService } from '../../estructura/assignments/teacher-assignments.service';
import type { AcademicPeriodsService } from '../../estructura/catalogs/academic-period/academic-periods.service';
import type { SchoolYearsService } from '../../estructura/school-years/school-years.service';
import type { LessonPlanRepository } from '../lesson-plans/lesson-plan.repository';
import { LessonPlanComplianceService } from './lesson-plan-compliance.service';

const NOW = new Date('2026-11-09T00:00:00Z');
const YEAR = '2026-2027';
const P1 = '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b01';
const P2 = '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b02';

const period = (id: string, number: number, schoolYear = YEAR): AcademicPeriod => ({
  id,
  schoolYear,
  number,
  startDate: '2026-09-01',
  endDate: null,
  createdAt: NOW,
  updatedAt: NOW,
});

function setup(options: { currentYear?: string | null; found?: AcademicPeriod | null } = {}) {
  const currentYear = options.currentYear === undefined ? YEAR : options.currentYear;
  const schoolYears = {
    requireCurrent: jest.fn(() =>
      currentYear
        ? Promise.resolve({ code: currentYear } as SchoolYear)
        : Promise.reject(new ConflictException('sin año vigente')),
    ),
  };
  const periods = {
    find: jest.fn(() => Promise.resolve(options.found ?? null)),
    list: jest.fn(() =>
      Promise.resolve({
        items: [period(P1, 1), period(P2, 2)],
        page: 1,
        pageSize: 100,
        totalItems: 2,
        totalPages: 1,
      }),
    ),
  };
  const assignments = { listActive: jest.fn(() => Promise.resolve([])) };
  const lessonPlans = { countDelivered: jest.fn(() => Promise.resolve([])) };
  const service = new LessonPlanComplianceService(
    lessonPlans as unknown as LessonPlanRepository,
    assignments as unknown as TeacherAssignmentsService,
    periods as unknown as AcademicPeriodsService,
    schoolYears as unknown as SchoolYearsService,
  );
  return { service, periods, assignments, lessonPlans };
}

describe('LessonPlanComplianceService.get', () => {
  it('responde 409 si no hay año lectivo vigente', async () => {
    const { service, lessonPlans } = setup({ currentYear: null });

    await expect(service.get({})).rejects.toBeInstanceOf(ConflictException);
    expect(lessonPlans.countDelivered).not.toHaveBeenCalled();
  });

  it('devuelve el año, los periodos con sus fechas y cuenta solo estados entregados', async () => {
    const { service, lessonPlans } = setup();

    const result = await service.get({});

    expect(result.schoolYear).toBe(YEAR);
    expect(result.periods).toEqual([
      { id: P1, number: 1, startDate: '2026-09-01', endDate: null },
      { id: P2, number: 2, startDate: '2026-09-01', endDate: null },
    ]);
    expect(lessonPlans.countDelivered).toHaveBeenCalledWith({
      schoolYear: YEAR,
      statuses: ['enviada', 'observaciones', 'revisada'],
      teacherId: undefined,
      periodId: undefined,
    });
  });

  it('responde 400 con periodId si el periodo no existe o es de otro año', async () => {
    for (const found of [null, period(P1, 1, '2025-2026')]) {
      const error = await setup({ found })
        .service.get({ periodId: P1 })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(RequestValidationException);
      expect((error as RequestValidationException).fieldErrors[0]?.field).toBe('periodId');
    }
  });

  it('filtra por periodo y por docente', async () => {
    const { service, lessonPlans } = setup({ found: period(P2, 2) });

    const result = await service.get({ periodId: P2, teacherId: 'teacher-1' });

    expect(result.periods.map((entry) => entry.id)).toEqual([P2]);
    expect(lessonPlans.countDelivered).toHaveBeenCalledWith(
      expect.objectContaining({ periodId: P2, teacherId: 'teacher-1' }),
    );
  });
});
