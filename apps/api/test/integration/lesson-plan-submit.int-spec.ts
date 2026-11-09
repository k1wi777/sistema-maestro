import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, ApiErrorCode, RecordStatus, UserRole } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import {
  auditRows,
  createPlan,
  forceStatus,
  setupPlanning,
  SUBMITTABLE_CONTENT,
  type LessonPlanBody,
  type Planning,
} from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { asUser, createTestUser, signIn, type Cookies, type TestUser } from './support/session';

describe('envío de planeaciones a coordinación (BE-52)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let teacherUser: TestUser;
  let teacher: Cookies;
  let other: Cookies;
  let coordinator: Cookies;
  let target: { gradeId: string; areaId: string };

  const as = (cookies: Cookies, method: 'get' | 'post' | 'patch', path: string) =>
    asUser(app, method, path, cookies, 'access');
  const plan = (extra: Record<string, unknown> = {}) =>
    createPlan(app, teacher, { ...target, periodId: planning.periods[1], ...extra });
  const submit = (cookies: Cookies, id: string) =>
    as(cookies, 'post', `/lesson-plans/${id}/submit`);
  const stored = (id: string) => prisma.lessonPlan.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    teacherUser = await createTestUser(app);
    teacher = await signIn(app, teacherUser);
    other = await signIn(app, await createTestUser(app));
    coordinator = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
    target = await planning.gradeAndArea('Primaria');
    await planning.assign(teacherUser.id, target.gradeId, target.areaId);
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  it('envía una planeación completa: pasa a enviada, registra la fecha y la bitácora (R9, R19)', async () => {
    const created = await plan(SUBMITTABLE_CONTENT);

    const res = await submit(teacher, created.id).expect(200);

    const body = res.body as LessonPlanBody;
    expect(body.status).toBe(RecordStatus.Submitted);
    expect(body.submittedAt).not.toBeNull();
    expect((await stored(created.id)).submittedAt).not.toBeNull();
    const rows = await auditRows(app, created.id);
    expect(rows.at(-1)).toMatchObject({
      action: 'Envió una planeación a coordinación',
      type: 'planeacion',
    });
    expect(rows.at(-1)?.dataBefore).toMatchObject({ status: 'borrador' });
    expect(rows.at(-1)?.dataAfter).toMatchObject({ status: 'enviada' });
  });

  it('lista cada campo obligatorio faltante con el formato común y no cambia el estado (R10)', async () => {
    const created = await plan();

    const res = await submit(teacher, created.id).expect(400);

    const error = apiErrorBodySchema.parse(res.body);
    expect(error.code).toBe(ApiErrorCode.Validation);
    expect(error.errors).toEqual([
      { field: 'expectedPerformance', reason: 'es obligatorio para enviar' },
      { field: 'developmentMoment', reason: 'es obligatorio para enviar' },
    ]);
    expect((await stored(created.id)).status).toBe('borrador');
    expect(await auditRows(app, created.id)).toHaveLength(1);
  });

  it('un campo solo con espacios cuenta como faltante y se reporta solo ese (R10)', async () => {
    const created = await plan({ expectedPerformance: 'Explica', developmentMoment: '   ' });

    const res = await submit(teacher, created.id).expect(400);

    expect(apiErrorBodySchema.parse(res.body).errors?.map((e) => e.field)).toEqual([
      'developmentMoment',
    ]);
  });

  it('se corrige y se vuelve a enviar tras devolverla con observaciones', async () => {
    const created = await plan({ expectedPerformance: 'Explica' });
    await submit(teacher, created.id).expect(400);
    await as(teacher, 'patch', `/lesson-plans/${created.id}`)
      .send({ developmentMoment: 'Trabajo en parejas' })
      .expect(200);
    await submit(teacher, created.id).expect(200);
    await forceStatus(app, created.id, RecordStatus.ChangesRequested);

    const res = await submit(teacher, created.id).expect(200);

    expect((res.body as LessonPlanBody).status).toBe('enviada');
  });

  it.each([RecordStatus.Submitted, RecordStatus.Reviewed, RecordStatus.Voided])(
    'responde 409 sin modificar la planeación en estado %s, antes que la validación del contenido (R5)',
    async (status) => {
      const created = await plan();
      await forceStatus(app, created.id, status);
      const before = await stored(created.id);

      const res = await submit(teacher, created.id).expect(409);

      expect(apiErrorBodySchema.parse(res.body).code).toBe(ApiErrorCode.Conflict);
      expect(await stored(created.id)).toEqual(before);
    },
  );

  it('coordinación recibe 403 y un docente ajeno 404 al enviar (R8)', async () => {
    const created = await plan(SUBMITTABLE_CONTENT);

    const forbidden = await submit(coordinator, created.id).expect(403);
    await submit(other, created.id).expect(404);

    expect(apiErrorBodySchema.parse(forbidden.body).code).toBe(ApiErrorCode.Forbidden);
    expect((await stored(created.id)).status).toBe('borrador');
  });
});
