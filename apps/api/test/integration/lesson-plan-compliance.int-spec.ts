import type { INestApplication } from '@nestjs/common';
import {
  apiErrorBodySchema,
  RecordStatus,
  UserRole,
  type ComplianceItem,
  type LessonPlanCompliance,
} from '@gns/shared';
import request from 'supertest';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import {
  asUser,
  createTestUser,
  serverOf,
  signIn,
  type Cookies,
  type TestUser,
} from './support/session';

const { Draft, Submitted, ChangesRequested, Reviewed, Voided } = RecordStatus;

describe('cumplimiento de entregas (BE-56)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let teacherA: TestUser;
  let teacherB: TestUser;
  let teacherC: TestUser;
  let teacher: Cookies;
  let coordinator: Cookies;
  let admin: Cookies;
  let grade1: string;
  let grade2: string;
  let area1: string;
  let area2: string;
  let area3: string;

  const get = (cookies: Cookies, query = '') =>
    asUser(app, 'get', `/lesson-plan-compliance${query}`, cookies, 'access');
  const compliance = async (cookies: Cookies, query: string): Promise<LessonPlanCompliance> =>
    (await get(cookies, query).expect(200)).body as LessonPlanCompliance;
  const of = (result: LessonPlanCompliance, teacherId: string) =>
    result.teachers.find((entry) => entry.teacher.id === teacherId);
  const cell = (items: ComplianceItem[], areaId: string, number: number) =>
    items.find((item) => item.area.id === areaId && item.period.number === number);

  const plan = (
    teacherId: string,
    gradeId: string,
    areaId: string,
    period: 1 | 2 | 3,
    status: RecordStatus,
  ) =>
    prisma.lessonPlan.create({
      data: {
        teacherId,
        gradeId,
        areaId,
        periodId: planning.periods[period],
        status,
        submittedAt: status === Draft || status === Voided ? null : new Date(),
      },
    });

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    teacherA = await createTestUser(app);
    teacherB = await createTestUser(app);
    teacherC = await createTestUser(app);
    teacher = await signIn(app, teacherA);
    coordinator = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
    admin = await signIn(app, await createTestUser(app, { role: UserRole.Administrator }));

    ({ gradeId: grade1, areaId: area1 } = await planning.gradeAndArea('Primaria'));
    ({ gradeId: grade2, areaId: area3 } = await planning.gradeAndArea('Bachillerato'));
    area2 = (await planning.gradeAndArea('Primaria')).areaId;

    await planning.assign(teacherA.id, grade1, area1);
    await planning.assign(teacherA.id, grade1, area2);
    await planning.assign(teacherA.id, grade2, area3, 'retirada');
    await planning.assign(teacherB.id, grade1, area1);

    // area1/periodo 1: tres estados que cuentan y dos que no.
    for (const status of [Submitted, ChangesRequested, Reviewed, Draft, Voided]) {
      await plan(teacherA.id, grade1, area1, 1, status);
    }
    // area1/periodo 2: solo borrador y anulada.
    await plan(teacherA.id, grade1, area1, 2, Draft);
    await plan(teacherA.id, grade1, area1, 2, Voided);
    // area2/periodo 1: una revisada.
    await plan(teacherA.id, grade1, area2, 1, Reviewed);
    // Sin asignación activa: asignación retirada y combinación sin asignación.
    await plan(teacherA.id, grade2, area3, 1, Submitted);
    await plan(teacherA.id, grade1, area3, 1, Submitted);
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  it('una entrada por docente con asignaciones activas y una celda por asignación y periodo (R5, R6)', async () => {
    const result = await compliance(coordinator, `?teacherId=${teacherA.id}`);

    expect(result.schoolYear).toBe(planning.year);
    expect(result.periods.map((period) => period.number)).toEqual([1, 2, 3]);
    expect(result.periods[0]).toEqual({
      id: planning.periods[1],
      number: 1,
      startDate: null,
      endDate: null,
    });
    expect(result.teachers).toHaveLength(1);
    const entry = of(result, teacherA.id);
    expect(entry?.items).toHaveLength(6);
    expect(entry).toMatchObject({ deliveredCount: 2, pendingCount: 4 });
    expect(entry?.items[0]).toMatchObject({
      grade: { id: grade1, name: expect.any(String) as string },
      level: { name: 'Primaria' },
    });
  });

  it('cuenta enviada, observaciones y revisada, y no el borrador ni lo anulado (R5, R6)', async () => {
    const entry = of(await compliance(coordinator, `?teacherId=${teacherA.id}`), teacherA.id);

    expect(cell(entry?.items ?? [], area1, 1)).toMatchObject({
      status: 'entregado',
      deliveredCount: 3,
    });
    expect(cell(entry?.items ?? [], area1, 2)).toMatchObject({
      status: 'pendiente',
      deliveredCount: 0,
    });
    expect(cell(entry?.items ?? [], area2, 1)).toMatchObject({
      status: 'entregado',
      deliveredCount: 1,
    });
    expect(cell(entry?.items ?? [], area2, 3)).toMatchObject({ status: 'pendiente' });
  });

  it('ignora las planeaciones de una asignación retirada y de una combinación sin asignación (R7)', async () => {
    const entry = of(await compliance(coordinator, `?teacherId=${teacherA.id}`), teacherA.id);

    expect(entry?.items.some((item) => item.area.id === area3)).toBe(false);
    expect(entry?.items.some((item) => item.grade.id === grade2)).toBe(false);
  });

  it('un docente con asignación activa y sin planeaciones aparece con todo pendiente; sin asignación no aparece (R5)', async () => {
    const result = await compliance(admin, '');

    expect(of(result, teacherB.id)).toMatchObject({ deliveredCount: 0, pendingCount: 3 });
    expect(of(result, teacherC.id)).toBeUndefined();
    expect(of(result, teacherA.id)).toBeDefined();
  });

  it('filtra por periodo y por docente (R8)', async () => {
    const result = await compliance(
      coordinator,
      `?teacherId=${teacherA.id}&periodId=${planning.periods[1]}`,
    );

    expect(result.periods.map((period) => period.number)).toEqual([1]);
    const entry = of(result, teacherA.id);
    expect(entry?.items).toHaveLength(2);
    expect(entry).toMatchObject({ deliveredCount: 2, pendingCount: 0 });
    expect((await compliance(coordinator, `?teacherId=${teacherB.id}`)).teachers).toHaveLength(1);
  });

  it('responde 400 con periodId si el periodo no existe o es de otro año (R8)', async () => {
    for (const periodId of [planning.otherYearPeriodId, '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b3c']) {
      const res = await get(coordinator, `?periodId=${periodId}`).expect(400);

      expect(apiErrorBodySchema.parse(res.body).errors?.[0]?.field).toBe('periodId');
    }
    await get(coordinator, '?periodId=x').expect(400);
    await get(coordinator, '?page=1').expect(400);
  });

  it('responde 403 a un docente y 401 sin sesión (R9, R18)', async () => {
    await get(teacher).expect(403);
    await request(serverOf(app)).get('/lesson-plan-compliance').expect(401);
  });
});
