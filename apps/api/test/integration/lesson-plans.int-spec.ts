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

interface PageBody {
  items: LessonPlanBody[];
  totalItems: number;
}

describe('planeaciones: crear, ver, editar y anular (BE-51)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let teacherUser: TestUser;
  let teacher: Cookies;
  let other: Cookies;
  let coordinator: Cookies;
  let admin: Cookies;
  let secondary: { gradeId: string; areaId: string };

  type Method = 'get' | 'post' | 'patch' | 'delete';
  const as = (cookies: Cookies, method: Method, path: string) =>
    asUser(app, method, path, cookies, 'access');
  const plan = (extra: Record<string, unknown> = {}) =>
    createPlan(app, teacher, { ...secondary, periodId: planning.periods[1], ...extra });
  const errorOf = (body: unknown) => apiErrorBodySchema.parse(body);

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    teacherUser = await createTestUser(app);
    teacher = await signIn(app, teacherUser);
    other = await signIn(app, await createTestUser(app));
    coordinator = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
    admin = await signIn(app, await createTestUser(app, { role: UserRole.Administrator }));
    secondary = await planning.gradeAndArea('Bachillerato');
    await planning.assign(teacherUser.id, secondary.gradeId, secondary.areaId);
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  describe('crear (R1, R2, R3)', () => {
    it('guarda un borrador del docente con el proyecto calculado y escribe la bitácora', async () => {
      const created = await plan({ topic: '  Movimiento  ', learningCorner: 'Zona STEAM+H' });

      expect(created).toMatchObject({
        status: RecordStatus.Draft,
        topic: 'Movimiento',
        crossCuttingProject: 'STEAM+H',
        teacher: { id: teacherUser.id },
        level: { name: 'Bachillerato' },
        period: { number: 1, schoolYear: planning.year },
        submittedAt: null,
        linkedResources: [],
      });
      const rows = await auditRows(app, created.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: 'planeacion',
        entity: 'planeacion',
        action: 'Creó una planeación',
        userId: teacherUser.id,
        role: 'docente',
      });
      expect(rows[0]?.dataAfter).toMatchObject({ status: 'borrador', topic: 'Movimiento' });
    });

    it.each([
      ['Preescolar bajo', 1, null],
      ['Preescolar alto (KTF)', 2, 'STEAM+H'],
      ['Primaria', 3, 'Emprendimiento Escolar'],
      ['Bachillerato', 3, 'Emprendimiento · Dragon Fire'],
      ['Bachillerato', 2, 'Ciudad+'],
      ['Nivel sin reglas', 1, null],
    ] as const)('nivel %s, periodo %i: proyecto %s', async (level, period, project) => {
      const target = await planning.gradeAndArea(level);
      await planning.assign(teacherUser.id, target.gradeId, target.areaId);

      const created = await createPlan(app, teacher, {
        gradeId: target.gradeId,
        areaId: target.areaId,
        periodId: planning.periods[period],
      });

      expect(created.crossCuttingProject).toBe(project);
    });

    it('no acepta el proyecto, el estado ni datos de estudiantes del cliente (400)', async () => {
      for (const extra of [
        { crossCuttingProject: 'Ciudad+' },
        { status: 'revisada' },
        { teacherId: teacherUser.id },
        { studentName: 'Ana' },
      ]) {
        const res = await as(teacher, 'post', '/lesson-plans')
          .send({ ...secondary, periodId: planning.periods[1], ...extra })
          .expect(400);

        expect(errorOf(res.body).code).toBe(ApiErrorCode.Validation);
      }
    });

    it('responde 403 sin asignación activa de ese grado y área, y no crea nada', async () => {
      const foreign = await planning.gradeAndArea('Bachillerato');
      const withdrawn = await planning.gradeAndArea('Bachillerato');
      await planning.assign(teacherUser.id, withdrawn.gradeId, withdrawn.areaId, 'retirada');
      const mine = { where: { teacherId: teacherUser.id } };
      const before = await prisma.lessonPlan.count(mine);

      for (const target of [
        foreign,
        withdrawn,
        { gradeId: secondary.gradeId, areaId: foreign.areaId },
      ]) {
        const res = await as(teacher, 'post', '/lesson-plans')
          .send({ gradeId: target.gradeId, areaId: target.areaId, periodId: planning.periods[1] })
          .expect(403);

        expect(errorOf(res.body).code).toBe(ApiErrorCode.Forbidden);
      }
      expect(await prisma.lessonPlan.count(mine)).toBe(before);
    });

    it('responde 400 con periodId si el periodo es de otro año o no existe', async () => {
      for (const periodId of [planning.otherYearPeriodId, '0b9d6c1e-2f4a-4d7e-8a1c-3d6e8f0a1b3c']) {
        const res = await as(teacher, 'post', '/lesson-plans')
          .send({ ...secondary, periodId })
          .expect(400);

        expect(errorOf(res.body).errors?.map((e) => e.field)).toEqual(['periodId']);
      }
    });

    it('rechaza la etapa CurioCity fuera de bachillerato y la acepta en bachillerato (400 curiocityStage)', async () => {
      const primary = await planning.gradeAndArea('Primaria');
      await planning.assign(teacherUser.id, primary.gradeId, primary.areaId);

      const res = await as(teacher, 'post', '/lesson-plans')
        .send({ ...primary, periodId: planning.periods[1], curiocityStage: 'Creo' })
        .expect(400);

      expect(errorOf(res.body).errors?.map((e) => e.field)).toEqual(['curiocityStage']);
      expect((await plan({ curiocityStage: 'Creo' })).curiocityStage).toBe('Creo');
      await as(teacher, 'post', '/lesson-plans')
        .send({ ...secondary, periodId: planning.periods[1], curiocityStage: 'Otra' })
        .expect(400);
    });

    it('responde 400 con dateTo si la fecha final es anterior a la inicial', async () => {
      const res = await as(teacher, 'post', '/lesson-plans')
        .send({
          ...secondary,
          periodId: planning.periods[1],
          dateFrom: '2026-09-25',
          dateTo: '2026-09-21',
        })
        .expect(400);

      expect(errorOf(res.body).errors?.map((e) => e.field)).toEqual(['dateTo']);
    });
  });

  describe('visibilidad (R7)', () => {
    it('el docente ve solo las suyas y coordinación y administración ven todas, borradores incluidos', async () => {
      const mine = await plan({ topic: 'Mía' });
      const strangerUser = await createTestUser(app);
      const stranger = await signIn(app, strangerUser);
      const theirs = await planning.gradeAndArea('Bachillerato');
      await planning.assign(strangerUser.id, theirs.gradeId, theirs.areaId);
      const foreign = await createPlan(app, stranger, {
        ...theirs,
        periodId: planning.periods[1],
        topic: 'Ajena',
      });
      expect(foreign.status).toBe(RecordStatus.Draft);

      const own = (await as(teacher, 'get', '/lesson-plans?pageSize=100').expect(200))
        .body as PageBody;
      expect(own.items.map((p) => p.id)).toContain(mine.id);
      expect(own.items.map((p) => p.id)).not.toContain(foreign.id);
      expect(own.items.every((p) => p.teacher.id === teacherUser.id)).toBe(true);

      for (const cookies of [coordinator, admin]) {
        const all = (await as(cookies, 'get', '/lesson-plans?pageSize=100').expect(200))
          .body as PageBody;
        expect(all.items.map((p) => p.id)).toEqual(expect.arrayContaining([mine.id, foreign.id]));
        await as(cookies, 'get', `/lesson-plans/${foreign.id}`).expect(200);
      }
      await as(stranger, 'get', `/lesson-plans/${mine.id}`).expect(404);
      await as(stranger, 'get', `/lesson-plans/${mine.id}/reviews`).expect(404);
      await as(teacher, 'get', `/lesson-plans/${foreign.id}`).expect(404);
    });

    it('filtra por estado y periodo y no expone datos de contacto del docente', async () => {
      const inPeriod2 = await plan({ periodId: planning.periods[2] });
      const submitted = await plan();
      await forceStatus(app, submitted.id, RecordStatus.Submitted);

      const byPeriod = (
        await as(
          teacher,
          'get',
          `/lesson-plans?pageSize=100&periodId=${planning.periods[2]}`,
        ).expect(200)
      ).body as PageBody;
      const byStatus = (
        await as(teacher, 'get', '/lesson-plans?pageSize=100&status=enviada').expect(200)
      ).body as PageBody;

      expect(byPeriod.items.every((p) => p.period.number === 2)).toBe(true);
      expect(byPeriod.items.map((p) => p.id)).toContain(inPeriod2.id);
      expect(byStatus.items.every((p) => p.status === 'enviada')).toBe(true);
      expect(byStatus.items.map((p) => p.id)).toContain(submitted.id);
      expect(JSON.stringify(byStatus)).not.toContain('@');
      await as(teacher, 'get', '/lesson-plans?status=inventado').expect(400);
    });
  });

  describe('editar (R4, R5, R8)', () => {
    it('el dueño edita en borrador: recorta, vacía con null, recalcula el proyecto al cambiar de periodo y audita antes y después', async () => {
      const created = await plan({ topic: 'Inicial', resources: 'Cartulina' });

      const res = await as(teacher, 'patch', `/lesson-plans/${created.id}`)
        .send({
          topic: '  Nuevo tema ',
          resources: null,
          periodId: planning.periods[3],
          dateFrom: '2026-10-01',
          dateTo: '2026-10-05',
          reasonableAdjustments: 'Lectura guiada en parejas.',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        topic: 'Nuevo tema',
        resources: null,
        crossCuttingProject: 'Emprendimiento · Dragon Fire',
        period: { number: 3 },
        dateFrom: '2026-10-01',
        dateTo: '2026-10-05',
        reasonableAdjustments: 'Lectura guiada en parejas.',
      });
      const rows = await auditRows(app, created.id);
      expect(rows.map((r) => r.action)).toEqual(['Creó una planeación', 'Editó una planeación']);
      expect(rows[1]?.dataBefore).toMatchObject({ topic: 'Inicial', resources: 'Cartulina' });
      expect(rows[1]?.dataAfter).toMatchObject({ topic: 'Nuevo tema', resources: null });
    });

    it('valida la fecha final contra la inicial guardada y el periodo contra el año vigente (400)', async () => {
      const created = await plan({ dateFrom: '2026-10-10' });

      const dates = await as(teacher, 'patch', `/lesson-plans/${created.id}`)
        .send({ dateTo: '2026-10-01' })
        .expect(400);
      const period = await as(teacher, 'patch', `/lesson-plans/${created.id}`)
        .send({ periodId: planning.otherYearPeriodId })
        .expect(400);

      expect(errorOf(dates.body).errors?.map((e) => e.field)).toEqual(['dateTo']);
      expect(errorOf(period.body).errors?.map((e) => e.field)).toEqual(['periodId']);
      await as(teacher, 'patch', `/lesson-plans/${created.id}`).send({}).expect(400);
      await as(teacher, 'patch', `/lesson-plans/${created.id}`)
        .send({ gradeId: secondary.gradeId })
        .expect(400);
    });

    it.each([RecordStatus.Submitted, RecordStatus.Reviewed, RecordStatus.Voided])(
      'responde 409 sin modificar la planeación en estado %s',
      async (status) => {
        const created = await plan({ topic: 'Intacta' });
        await forceStatus(app, created.id, status);
        const before = await prisma.lessonPlan.findUniqueOrThrow({ where: { id: created.id } });

        const res = await as(teacher, 'patch', `/lesson-plans/${created.id}`)
          .send({ topic: 'Cambiada' })
          .expect(409);

        expect(errorOf(res.body).code).toBe(ApiErrorCode.Conflict);
        const after = await prisma.lessonPlan.findUniqueOrThrow({ where: { id: created.id } });
        expect(after).toEqual(before);
        expect((await auditRows(app, created.id)).map((r) => r.action)).toEqual([
          'Creó una planeación',
        ]);
      },
    );

    it('permite editar en observaciones', async () => {
      const created = await plan();
      await forceStatus(app, created.id, RecordStatus.ChangesRequested);

      await as(teacher, 'patch', `/lesson-plans/${created.id}`)
        .send({ topic: 'Ajustado' })
        .expect(200);
    });

    it('quien ve la planeación sin ser su dueño recibe 403 al editarla (coordinación) y 404 si no la ve (docente)', async () => {
      const created = await plan();

      const forbidden = await as(coordinator, 'patch', `/lesson-plans/${created.id}`)
        .send({ topic: 'X' })
        .expect(403);
      const admin403 = await as(admin, 'patch', `/lesson-plans/${created.id}`)
        .send({ topic: 'X' })
        .expect(403);
      await as(other, 'patch', `/lesson-plans/${created.id}`).send({ topic: 'X' }).expect(404);

      expect(errorOf(forbidden.body).code).toBe(ApiErrorCode.Forbidden);
      expect(errorOf(admin403.body).code).toBe(ApiErrorCode.Forbidden);
      expect(
        (await prisma.lessonPlan.findUniqueOrThrow({ where: { id: created.id } })).topic,
      ).toBeNull();
    });
  });

  describe('anular (R6)', () => {
    it('el dueño anula un borrador con motivo: no se borra y la bitácora guarda el motivo', async () => {
      const created = await plan();

      const res = await as(teacher, 'post', `/lesson-plans/${created.id}/void`)
        .send({ reason: '  Planeación duplicada  ' })
        .expect(200);

      expect(res.body).toMatchObject({ id: created.id, status: 'anulado' });
      await as(teacher, 'get', `/lesson-plans/${created.id}`).expect(200);
      const rows = await auditRows(app, created.id);
      expect(rows.at(-1)).toMatchObject({
        action: 'Anuló una planeación',
        detail: 'Planeación duplicada',
      });
      expect(rows.at(-1)?.dataAfter).toMatchObject({ status: 'anulado' });
    });

    it.each([RecordStatus.Submitted, RecordStatus.ChangesRequested])(
      'el dueño anula desde %s',
      async (status) => {
        const created = await plan();
        await forceStatus(app, created.id, status);

        await as(teacher, 'post', `/lesson-plans/${created.id}/void`)
          .send({ reason: 'Ya no aplica' })
          .expect(200);
      },
    );

    it('el dueño no anula una revisada (409), pero coordinación sí, con constancia', async () => {
      const created = await plan();
      await forceStatus(app, created.id, RecordStatus.Reviewed);

      const res = await as(teacher, 'post', `/lesson-plans/${created.id}/void`)
        .send({ reason: 'Quiero anularla' })
        .expect(409);
      expect(errorOf(res.body).code).toBe(ApiErrorCode.Conflict);

      await as(coordinator, 'post', `/lesson-plans/${created.id}/void`)
        .send({ reason: 'Error de coordinación' })
        .expect(200);
      const rows = await auditRows(app, created.id);
      expect(rows.at(-1)).toMatchObject({
        userId: expect.any(String) as string,
        role: 'coordinador',
        detail: 'Error de coordinación',
      });
    });

    it('coordinación anula desde cualquier estado salvo anulado; una anulada no cambia (409)', async () => {
      const created = await plan();
      await as(coordinator, 'post', `/lesson-plans/${created.id}/void`)
        .send({ reason: 'Motivo uno' })
        .expect(200);

      for (const cookies of [teacher, coordinator, admin]) {
        await as(cookies, 'post', `/lesson-plans/${created.id}/void`)
          .send({ reason: 'Otra vez' })
          .expect(409);
      }
      expect(
        (await auditRows(app, created.id)).filter((r) => r.action.startsWith('Anuló')),
      ).toHaveLength(1);
    });

    it('exige un motivo de 3 a 300 caracteres y rechaza campos desconocidos (400)', async () => {
      const created = await plan();

      for (const body of [
        {},
        { reason: 'ab' },
        { reason: 'x'.repeat(301) },
        { reason: 'Motivo', extra: 1 },
      ]) {
        await as(teacher, 'post', `/lesson-plans/${created.id}/void`).send(body).expect(400);
      }
      expect(
        (await prisma.lessonPlan.findUniqueOrThrow({ where: { id: created.id } })).status,
      ).toBe('borrador');
    });

    it('un docente ajeno recibe 404 al anular', async () => {
      const created = await plan();

      await as(other, 'post', `/lesson-plans/${created.id}/void`)
        .send({ reason: 'Intento ajeno' })
        .expect(404);
    });
  });

  describe('una planeación revisada queda bloqueada para el dueño (R5)', () => {
    it('editar, enviar y enlaces responden 409 y la planeación no cambia', async () => {
      const created = await plan(SUBMITTABLE_CONTENT);
      await forceStatus(app, created.id, RecordStatus.Reviewed);
      const link = { tool: 'Canva', name: 'Presentación', url: 'https://canva.com/d/1' };

      await as(teacher, 'patch', `/lesson-plans/${created.id}`).send({ topic: 'X' }).expect(409);
      await as(teacher, 'post', `/lesson-plans/${created.id}/submit`).expect(409);
      await as(teacher, 'post', `/lesson-plans/${created.id}/resources`).send(link).expect(409);

      const stored = await prisma.lessonPlan.findUniqueOrThrow({ where: { id: created.id } });
      expect(stored.status).toBe('revisada');
      expect(stored.topic).toBeNull();
    });
  });
});
