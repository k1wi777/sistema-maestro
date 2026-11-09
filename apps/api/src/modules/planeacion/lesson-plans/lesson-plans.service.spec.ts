import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ApiErrorCode,
  AreaType,
  RecordStatus,
  UserRole,
  type AcademicPeriod,
  type LessonPlan,
  type MyAssignments,
  type SchoolYear,
} from '@gns/shared';
import type { RequestUser } from '../../../core/audit/request-user';
import { RequestValidationException } from '../../../core/http/request-validation.exception';
import type { TeacherAssignmentsService } from '../../estructura/assignments/teacher-assignments.service';
import type { AcademicPeriodsService } from '../../estructura/catalogs/academic-period/academic-periods.service';
import type { SchoolYearsService } from '../../estructura/school-years/school-years.service';
import type { NewReview, ReviewRepository } from '../review/review.repository';
import { ReviewsService } from '../review/reviews.service';
import type { LessonPlanRepository } from './lesson-plan.repository';
import { LessonPlansService } from './lesson-plans.service';

const NOW = new Date('2026-11-09T00:00:00Z');
const YEAR = '2026-2027';
const owner: RequestUser = { id: 'owner', role: UserRole.Teacher, sessionId: 's1' };
const stranger: RequestUser = { id: 'stranger', role: UserRole.Teacher, sessionId: 's2' };
const coordinator: RequestUser = { id: 'coord', role: UserRole.Coordinator, sessionId: 's3' };
const UUID_PERIOD = '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b3c';

function plan(overrides: Partial<LessonPlan> = {}): LessonPlan {
  return {
    id: 'plan-1',
    teacher: { id: 'owner', fullName: 'Docente Uno' },
    grade: { id: 'g-1', name: '7°' },
    level: { id: 'l-1', name: 'Bachillerato' },
    area: { id: 'a-1', name: 'Física' },
    period: { id: 'p-1', number: 1, schoolYear: YEAR },
    dateFrom: '2026-09-21',
    dateTo: '2026-09-25',
    topic: 'Tema',
    crossCuttingProject: 'STEAM+H',
    expectedPerformance: 'Explica',
    learningCorner: null,
    curiocityStage: null,
    explorationMoment: null,
    developmentMoment: 'Trabaja',
    socializationMoment: null,
    closingMoment: null,
    resources: null,
    reasonableAdjustments: null,
    status: RecordStatus.Draft,
    submittedAt: null,
    linkedResources: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

interface Options {
  stored?: LessonPlan | null;
  period?: Partial<AcademicPeriod> | null;
  assigned?: boolean;
  levelName?: string;
}

function setup(options: Options = {}) {
  const stored = options.stored === undefined ? plan() : options.stored;
  const reviews: NewReview[] = [];
  const repository = {
    findById: jest.fn(() => Promise.resolve(stored)),
    findPage: jest.fn(() =>
      Promise.resolve({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }),
    ),
    findRecordById: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(() => Promise.resolve(plan())),
    updateIfStatus: jest.fn(() => Promise.resolve(true)),
    lock: jest.fn(() => Promise.resolve()),
    countDelivered: jest.fn(() => Promise.resolve([])),
  } satisfies LessonPlanRepository;
  const reviewRepository = {
    insert: jest.fn((review: NewReview) => {
      reviews.push(review);
      return Promise.resolve();
    }),
    findByRecord: jest.fn(() => Promise.resolve([])),
  } satisfies ReviewRepository;
  const mine: MyAssignments = {
    schoolYear: YEAR,
    grades:
      options.assigned === false
        ? []
        : [
            {
              grade: { id: 'g-1', name: '7°', sortOrder: 7 },
              level: { id: 'l-1', name: options.levelName ?? 'Bachillerato' },
              isHomeroomTeacher: false,
              areas: [{ assignmentId: 'as-1', id: 'a-1', name: 'Física', type: AreaType.Subject }],
            },
          ],
  };
  const assignments = { listMine: jest.fn(() => Promise.resolve(mine)) };
  const periods = {
    find: jest.fn(() =>
      Promise.resolve(
        options.period === null
          ? null
          : { id: UUID_PERIOD, schoolYear: YEAR, number: 2, ...options.period },
      ),
    ),
  };
  const schoolYears = {
    requireCurrent: jest.fn(() => Promise.resolve({ code: YEAR } as SchoolYear)),
  };
  const service = new LessonPlansService(
    repository,
    assignments as unknown as TeacherAssignmentsService,
    periods as unknown as AcademicPeriodsService,
    schoolYears as unknown as SchoolYearsService,
    new ReviewsService(reviewRepository),
  );
  return { service, repository, reviews, periods };
}

const createInput = { gradeId: 'g-1', areaId: 'a-1', periodId: UUID_PERIOD };

async function fieldsOf(promise: Promise<unknown>): Promise<string[]> {
  try {
    await promise;
  } catch (error) {
    return (error as RequestValidationException).fieldErrors.map((item) => item.field);
  }
  throw new Error('Debió fallar con errores de validación');
}

describe('LessonPlansService.create', () => {
  it('fija el proyecto transversal por nivel y número de periodo, sin aceptarlo del cliente', async () => {
    const { service, repository } = setup();

    await service.create(owner, { ...createInput, topic: 'Tema' });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        teacherId: 'owner',
        crossCuttingProject: 'Ciudad+',
        topic: 'Tema',
      }),
    );
  });

  it('deja el proyecto vacío en un nivel sin proyectos', async () => {
    const { service, repository } = setup({ levelName: 'Preescolar bajo' });

    await service.create(owner, createInput);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ crossCuttingProject: null }),
    );
  });

  it('responde 403 sin asignación activa de ese grado y área, antes de validar el contenido', async () => {
    const { service, repository } = setup({ assigned: false });

    await expect(
      service.create(owner, { ...createInput, dateFrom: '2026-09-25', dateTo: '2026-09-21' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('responde 400 con periodId si el periodo no existe o es de otro año', async () => {
    expect(await fieldsOf(setup({ period: null }).service.create(owner, createInput))).toEqual([
      'periodId',
    ]);
    expect(
      await fieldsOf(
        setup({ period: { schoolYear: '2025-2026' } }).service.create(owner, createInput),
      ),
    ).toEqual(['periodId']);
  });

  it('responde 400 con dateTo y curiocityStage listando todos los campos', async () => {
    const { service } = setup({ levelName: 'Primaria' });

    expect(
      await fieldsOf(
        service.create(owner, {
          ...createInput,
          dateFrom: '2026-09-25',
          dateTo: '2026-09-21',
          curiocityStage: 'Creo',
        }),
      ),
    ).toEqual(['dateTo', 'curiocityStage']);
  });
});

describe('LessonPlansService: visibilidad y dueño (404 → 403 → 409 → 400)', () => {
  it('un docente ajeno recibe 404 en detalle, edición, envío, anulación e historial', async () => {
    const { service } = setup({ stored: plan({ status: RecordStatus.Reviewed }) });

    for (const call of [
      () => service.get(stranger, 'plan-1'),
      () => service.update(stranger, 'plan-1', { topic: 'X' }),
      () => service.submit(stranger, 'plan-1'),
      () => service.voidPlan(stranger, 'plan-1'),
      () => service.history(stranger, 'plan-1'),
    ]) {
      await expect(call()).rejects.toBeInstanceOf(NotFoundException);
    }
  });

  it('coordinación ve todas pero no edita ni envía: 403 aunque el estado también lo impediría', async () => {
    const { service } = setup({ stored: plan({ status: RecordStatus.Reviewed }) });

    await expect(service.get(coordinator, 'plan-1')).resolves.toBeDefined();
    await expect(service.update(coordinator, 'plan-1', { topic: 'X' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.submit(coordinator, 'plan-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el listado de un docente se limita a sus planeaciones y el de coordinación no', async () => {
    const { service, repository } = setup();
    const query = {
      page: 1,
      pageSize: 20,
      sort: { field: 'updatedAt' as const, order: 'desc' as const },
      filters: {},
    };

    await service.list(owner, query);
    await service.list(coordinator, query);

    expect(repository.findPage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ filters: { teacherId: 'owner' } }),
    );
    expect(repository.findPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ filters: {} }),
    );
  });

  it('un docente con teacherId ajeno en el filtro solo ve lo suyo; coordinación respeta el filtro', async () => {
    const { service, repository } = setup();
    const query = {
      page: 1,
      pageSize: 20,
      sort: { field: 'submittedAt' as const, order: 'desc' as const },
      filters: { teacherId: 'stranger', gradeId: 'g-1' },
    };

    await service.list(owner, query);
    await service.list(coordinator, query);

    expect(repository.findPage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ filters: { teacherId: 'owner', gradeId: 'g-1' } }),
    );
    expect(repository.findPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ filters: { teacherId: 'stranger', gradeId: 'g-1' } }),
    );
  });
});

describe('LessonPlansService.update', () => {
  it.each([RecordStatus.Submitted, RecordStatus.Reviewed, RecordStatus.Voided])(
    'responde 409 sin modificar nada en estado %s',
    async (status) => {
      const { service, repository } = setup({ stored: plan({ status }) });

      await expect(service.update(owner, 'plan-1', { topic: 'X' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.updateIfStatus).not.toHaveBeenCalled();
    },
  );

  it('valida la fecha final contra la inicial guardada cuando la petición trae solo una', async () => {
    const { service } = setup();

    expect(await fieldsOf(service.update(owner, 'plan-1', { dateTo: '2026-09-01' }))).toEqual([
      'dateTo',
    ]);
  });

  it('rechaza la etapa CurioCity en un nivel que no es bachillerato', async () => {
    const { service } = setup({
      stored: plan({ level: { id: 'l-2', name: 'Primaria' } }),
    });

    expect(await fieldsOf(service.update(owner, 'plan-1', { curiocityStage: 'Creo' }))).toEqual([
      'curiocityStage',
    ]);
  });

  it('recalcula el proyecto al cambiar de periodo y no lo toca si no cambia', async () => {
    const { service, repository } = setup();

    await service.update(owner, 'plan-1', { periodId: UUID_PERIOD, topic: 'Nuevo' });
    await service.update(owner, 'plan-1', { topic: 'Otro' });

    expect(repository.updateIfStatus).toHaveBeenNthCalledWith(
      1,
      'plan-1',
      [RecordStatus.Draft, RecordStatus.ChangesRequested],
      expect.objectContaining({ periodId: UUID_PERIOD, crossCuttingProject: 'Ciudad+' }),
    );
    expect(repository.updateIfStatus).toHaveBeenNthCalledWith(2, 'plan-1', expect.anything(), {
      topic: 'Otro',
    });
  });

  it('responde 400 si el nuevo periodo es de otro año', async () => {
    const { service } = setup({ period: { schoolYear: '2025-2026' } });

    expect(await fieldsOf(service.update(owner, 'plan-1', { periodId: UUID_PERIOD }))).toEqual([
      'periodId',
    ]);
  });

  it('responde 409 si otra petición movió la planeación entre la lectura y el UPDATE', async () => {
    const { service, repository } = setup();
    repository.updateIfStatus.mockResolvedValueOnce(false);

    await expect(service.update(owner, 'plan-1', { topic: 'X' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('LessonPlansService.submit', () => {
  it('pasa a enviada con la fecha de envío', async () => {
    const { service, repository } = setup();

    await service.submit(owner, 'plan-1');

    expect(repository.updateIfStatus).toHaveBeenCalledWith(
      'plan-1',
      [RecordStatus.Draft, RecordStatus.ChangesRequested],
      { status: RecordStatus.Submitted, submittedAt: expect.any(Date) as Date },
    );
  });

  it('lista cada campo faltante con 400 y no cambia el estado', async () => {
    const { service, repository } = setup({
      stored: plan({ expectedPerformance: '   ', developmentMoment: null }),
    });

    expect(await fieldsOf(service.submit(owner, 'plan-1'))).toEqual([
      'expectedPerformance',
      'developmentMoment',
    ]);
    expect(repository.updateIfStatus).not.toHaveBeenCalled();
  });

  it('responde 409 antes de validar el contenido si ya no es editable', async () => {
    const { service } = setup({
      stored: plan({ status: RecordStatus.Submitted, expectedPerformance: null }),
    });

    await expect(service.submit(owner, 'plan-1')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('LessonPlansService.voidPlan', () => {
  it.each([RecordStatus.Draft, RecordStatus.Submitted, RecordStatus.ChangesRequested])(
    'el dueño anula desde %s',
    async (status) => {
      const { service, repository } = setup({ stored: plan({ status }) });

      await service.voidPlan(owner, 'plan-1');

      expect(repository.updateIfStatus).toHaveBeenCalledWith('plan-1', expect.anything(), {
        status: RecordStatus.Voided,
      });
    },
  );

  it('el dueño no anula una revisada (409), pero coordinación sí', async () => {
    const reviewed = plan({ status: RecordStatus.Reviewed });

    await expect(
      setup({ stored: reviewed }).service.voidPlan(owner, 'plan-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    const { service, repository } = setup({ stored: reviewed });
    await service.voidPlan(coordinator, 'plan-1');
    expect(repository.updateIfStatus).toHaveBeenCalled();
  });

  it('nadie anula una anulada (409)', async () => {
    const voided = plan({ status: RecordStatus.Voided });

    for (const user of [owner, coordinator]) {
      await expect(
        setup({ stored: voided }).service.voidPlan(user, 'plan-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    }
  });
});

describe('LessonPlansService: aprobar y devolver', () => {
  const submitted = plan({ status: RecordStatus.Submitted });

  it('aprueba una enviada y crea una sola fila de decisión', async () => {
    const { service, repository, reviews } = setup({ stored: submitted });

    await service.approve(coordinator, 'plan-1', { comment: 'Bien' });

    expect(repository.lock).toHaveBeenCalledWith('plan-1');
    expect(repository.updateIfStatus).toHaveBeenCalledWith('plan-1', [RecordStatus.Submitted], {
      status: RecordStatus.Reviewed,
    });
    expect(reviews.map((row) => [row.action, row.comment])).toEqual([['aprobada', 'Bien']]);
  });

  it('devuelve con ajustes: aplica los campos y crea la fila de ajuste con antes y después, y la decisión', async () => {
    const { service, repository, reviews } = setup({ stored: submitted });

    await service.returnPlan(coordinator, 'plan-1', {
      comment: 'Revisa',
      changes: { topic: 'Nuevo tema', closingMoment: 'Cierre' },
    });

    expect(repository.updateIfStatus).toHaveBeenCalledWith('plan-1', [RecordStatus.Submitted], {
      topic: 'Nuevo tema',
      closingMoment: 'Cierre',
      status: RecordStatus.ChangesRequested,
    });
    expect(reviews.map((row) => row.action)).toEqual(['ajuste', 'observaciones']);
    expect(reviews[0]?.adjustedFields).toEqual(['tema', 'momento_cierre']);
    expect(reviews[0]?.changes).toEqual([
      { field: 'tema', before: 'Tema', after: 'Nuevo tema' },
      { field: 'momento_cierre', before: null, after: 'Cierre' },
    ]);
  });

  it('responde 400 sin decidir si los ajustes no cambian ningún valor', async () => {
    const { service, repository, reviews } = setup({ stored: submitted });

    expect(
      await fieldsOf(service.approve(coordinator, 'plan-1', { changes: { topic: 'Tema' } })),
    ).toEqual(['changes']);
    expect(repository.updateIfStatus).not.toHaveBeenCalled();
    expect(reviews).toEqual([]);
  });

  it('responde 400 con la ruta changes si un ajuste rompe una regla', async () => {
    const { service } = setup({ stored: submitted });

    expect(
      await fieldsOf(service.approve(coordinator, 'plan-1', { changes: { dateTo: '2026-01-01' } })),
    ).toEqual(['changes.dateTo']);
  });

  it.each([
    RecordStatus.Draft,
    RecordStatus.ChangesRequested,
    RecordStatus.Reviewed,
    RecordStatus.Voided,
  ])('responde 409 sin filas ni ajustes si está en %s', async (status) => {
    const { service, repository, reviews } = setup({ stored: plan({ status }) });

    await expect(
      service.approve(coordinator, 'plan-1', { changes: { topic: 'X' } }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.returnPlan(coordinator, 'plan-1', { comment: 'x' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.updateIfStatus).not.toHaveBeenCalled();
    expect(reviews).toEqual([]);
  });

  it('responde 403 autorrevision_no_permitida si el revisor es el docente, con o sin ajustes', async () => {
    const own = plan({
      status: RecordStatus.Submitted,
      teacher: { id: 'coord', fullName: 'Coordinadora' },
    });
    const { service, repository, reviews } = setup({ stored: own });

    for (const call of [
      () => service.approve(coordinator, 'plan-1', {}),
      () => service.returnPlan(coordinator, 'plan-1', { comment: 'x', changes: { topic: 'Y' } }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: ApiErrorCode.SelfReviewForbidden });
    }
    expect(repository.lock).not.toHaveBeenCalled();
    expect(repository.updateIfStatus).not.toHaveBeenCalled();
    expect(reviews).toEqual([]);
  });
});
