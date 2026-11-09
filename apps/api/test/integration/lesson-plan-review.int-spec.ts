import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, ApiErrorCode, RecordStatus, UserRole, type Review } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { ReviewsService } from '../../src/modules/planeacion/review/reviews.service';
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

// La API serializa las fechas como texto ISO; en la prueba se lee el JSON tal cual.
type ReviewBody = Omit<Review, 'date'> & { date: string };

describe('revisión de coordinación de planeaciones (BE-54)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let teacherUser: TestUser;
  let teacher: Cookies;
  let other: Cookies;
  let coordA: Cookies;
  let coordB: Cookies;
  let coordAUser: TestUser;
  let admin: Cookies;
  let adminUser: TestUser;
  let target: { gradeId: string; areaId: string };

  type Method = 'get' | 'post' | 'patch';
  const as = (cookies: Cookies, method: Method, path: string) =>
    asUser(app, method, path, cookies, 'access');
  const approve = (cookies: Cookies, id: string, body: Record<string, unknown> = {}) =>
    as(cookies, 'post', `/lesson-plans/${id}/approve`).send(body);
  const giveBack = (cookies: Cookies, id: string, body: Record<string, unknown>) =>
    as(cookies, 'post', `/lesson-plans/${id}/return`).send(body);
  const history = async (cookies: Cookies, id: string) =>
    (await as(cookies, 'get', `/lesson-plans/${id}/reviews`).expect(200)).body as ReviewBody[];
  const stored = (id: string) => prisma.lessonPlan.findUniqueOrThrow({ where: { id } });
  const reviewRows = (id: string) =>
    prisma.review.findMany({
      where: { recordId: id },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

  /** Planeación del docente lista y enviada, con contenido que los ajustes pueden cambiar. */
  async function submitted(extra: Record<string, unknown> = {}): Promise<LessonPlanBody> {
    const created = await createPlan(app, teacher, {
      ...target,
      periodId: planning.periods[1],
      topic: 'Tema original',
      ...SUBMITTABLE_CONTENT,
      ...extra,
    });
    await as(teacher, 'post', `/lesson-plans/${created.id}/submit`).expect(200);
    return created;
  }

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    teacherUser = await createTestUser(app);
    teacher = await signIn(app, teacherUser);
    other = await signIn(app, await createTestUser(app));
    coordAUser = await createTestUser(app, { role: UserRole.Coordinator });
    coordA = await signIn(app, coordAUser);
    coordB = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
    adminUser = await createTestUser(app, { role: UserRole.Administrator });
    admin = await signIn(app, adminUser);
    target = await planning.gradeAndArea('Bachillerato');
    for (const user of [teacherUser, coordAUser, adminUser]) {
      await planning.assign(user.id, target.gradeId, target.areaId);
    }
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  describe('aprobar y devolver sin ajustes (R14, R15)', () => {
    it('aprueba una enviada: pasa a revisada, crea una fila aprobada y la bitácora', async () => {
      const created = await submitted();

      const res = await approve(coordA, created.id, { comment: 'Planeación clara' }).expect(200);

      expect((res.body as LessonPlanBody).status).toBe(RecordStatus.Reviewed);
      const rows = await reviewRows(created.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        recordType: 'planeacion',
        action: 'aprobada',
        comment: 'Planeación clara',
        reviewerId: coordAUser.id,
        adjustedFields: [],
        changes: null,
      });
      const audit = (await auditRows(app, created.id)).at(-1);
      expect(audit).toMatchObject({
        action: 'Aprobó una planeación',
        type: 'planeacion',
        role: 'coordinador',
        userId: coordAUser.id,
      });
      expect(audit?.dataBefore).toMatchObject({ status: 'enviada' });
      expect(audit?.dataAfter).toMatchObject({ status: 'revisada' });
    });

    it('aprobar admite comentario vacío y el administrador también puede revisar', async () => {
      const created = await submitted();

      await approve(admin, created.id).expect(200);

      expect((await reviewRows(created.id))[0]).toMatchObject({
        action: 'aprobada',
        comment: null,
        reviewerId: adminUser.id,
      });
    });

    it('devuelve una enviada con comentario: pasa a observaciones y crea la fila con ese comentario', async () => {
      const created = await submitted();

      const res = await giveBack(coordA, created.id, { comment: 'Precisa el desempeño' }).expect(
        200,
      );

      expect((res.body as LessonPlanBody).status).toBe(RecordStatus.ChangesRequested);
      expect(await reviewRows(created.id)).toMatchObject([
        { action: 'observaciones', comment: 'Precisa el desempeño' },
      ]);
      expect((await auditRows(app, created.id)).at(-1)).toMatchObject({
        action: 'Devolvió una planeación con observaciones',
      });
    });

    it('devolver exige un comentario (400) y no cambia nada', async () => {
      const created = await submitted();

      for (const body of [{}, { comment: '   ' }, { comment: 'x'.repeat(2001) }]) {
        await giveBack(coordA, created.id, body).expect(400);
      }
      expect((await stored(created.id)).status).toBe('enviada');
      expect(await reviewRows(created.id)).toEqual([]);
    });

    it('rechaza campos desconocidos y el periodo como ajuste (400)', async () => {
      const created = await submitted();

      for (const body of [
        { extra: 1 },
        { changes: { periodId: planning.periods[2] } },
        { changes: { crossCuttingProject: 'Ciudad+' } },
        { changes: { studentName: 'Ana' } },
        { changes: {} },
      ]) {
        await approve(coordA, created.id, body).expect(400);
      }
      expect((await stored(created.id)).status).toBe('enviada');
    });
  });

  describe('aprobar y devolver con ajustes (R16, R18)', () => {
    it('aprobar con ajustes: aplica los campos y crea primero la fila ajuste y luego la aprobada', async () => {
      const created = await submitted({ closingMoment: 'Cierre inicial' });

      const res = await approve(coordA, created.id, {
        comment: 'Ajusté el tema y el cierre',
        changes: {
          topic: 'Tema ajustado',
          closingMoment: 'Cierre ajustado',
          resources: 'Cartulina',
        },
      }).expect(200);

      expect(res.body).toMatchObject({
        status: 'revisada',
        topic: 'Tema ajustado',
        closingMoment: 'Cierre ajustado',
        resources: 'Cartulina',
      });
      const rows = await reviewRows(created.id);
      expect(rows.map((row) => row.action)).toEqual(['ajuste', 'aprobada']);
      expect(rows[0]).toMatchObject({
        comment: null,
        adjustedFields: ['tema', 'momento_cierre', 'recursos'],
        changes: {
          tema: { antes: 'Tema original', despues: 'Tema ajustado' },
          momento_cierre: { antes: 'Cierre inicial', despues: 'Cierre ajustado' },
          recursos: { antes: null, despues: 'Cartulina' },
        },
      });
      expect(rows[1]).toMatchObject({ comment: 'Ajusté el tema y el cierre', adjustedFields: [] });
      expect(rows[0]?.date).toEqual(rows[1]?.date);
      const audit = (await auditRows(app, created.id)).at(-1);
      expect(audit?.dataBefore).toMatchObject({ topic: 'Tema original', status: 'enviada' });
      expect(audit?.dataAfter).toMatchObject({ topic: 'Tema ajustado', status: 'revisada' });
    });

    it('devolver con ajustes: aplica los campos, deja observaciones y el docente edita sobre lo ajustado', async () => {
      const created = await submitted();

      await giveBack(coordA, created.id, {
        comment: 'Revisa el desempeño',
        changes: { expectedPerformance: 'Desempeño ajustado' },
      }).expect(200);

      expect((await reviewRows(created.id)).map((row) => row.action)).toEqual([
        'ajuste',
        'observaciones',
      ]);
      const seen = (await as(teacher, 'get', `/lesson-plans/${created.id}`).expect(200))
        .body as LessonPlanBody;
      expect(seen).toMatchObject({
        status: 'observaciones',
        expectedPerformance: 'Desempeño ajustado',
      });
      await as(teacher, 'patch', `/lesson-plans/${created.id}`)
        .send({ topic: 'Tema corregido por el docente' })
        .expect(200);
      await as(teacher, 'post', `/lesson-plans/${created.id}/submit`).expect(200);
    });

    it('solo guarda los campos que de verdad cambiaron', async () => {
      const created = await submitted();

      await approve(coordA, created.id, {
        changes: { topic: 'Tema original', closingMoment: 'Nuevo cierre', dateFrom: null },
      }).expect(200);

      const adjustment = (await reviewRows(created.id))[0];
      expect(adjustment?.adjustedFields).toEqual(['momento_cierre']);
      expect(adjustment?.changes).toEqual({
        momento_cierre: { antes: null, despues: 'Nuevo cierre' },
      });
    });

    it('responde 400 sin aplicar nada si los ajustes no cambian ningún valor', async () => {
      const created = await submitted();

      const res = await approve(coordA, created.id, {
        changes: { topic: 'Tema original', closingMoment: null },
      }).expect(400);

      expect(apiErrorBodySchema.parse(res.body).errors?.map((e) => e.field)).toEqual(['changes']);
      expect((await stored(created.id)).status).toBe('enviada');
      expect(await reviewRows(created.id)).toEqual([]);
      expect((await auditRows(app, created.id)).map((r) => r.action)).toEqual([
        'Creó una planeación',
        'Envió una planeación a coordinación',
      ]);
    });

    it('responde 400 con la ruta del ajuste si rompe una regla (fecha final, etapa en otro nivel)', async () => {
      const created = await submitted({ dateFrom: '2026-10-10' });

      const dates = await approve(coordA, created.id, { changes: { dateTo: '2026-10-01' } }).expect(
        400,
      );
      const stage = await approve(coordA, created.id, {
        changes: { curiocityStage: 'Otra' },
      }).expect(400);

      expect(apiErrorBodySchema.parse(dates.body).errors?.map((e) => e.field)).toEqual([
        'changes.dateTo',
      ]);
      expect(apiErrorBodySchema.parse(stage.body).code).toBe(ApiErrorCode.Validation);
      expect(await reviewRows(created.id)).toEqual([]);
    });

    it('el historial devuelve en orden cronológico cada acción con revisor, campos y valores antes y después', async () => {
      const created = await submitted();
      await giveBack(coordA, created.id, {
        comment: 'Primera ronda',
        changes: { topic: 'Tema de coordinación' },
      }).expect(200);
      await as(teacher, 'post', `/lesson-plans/${created.id}/submit`).expect(200);
      await approve(coordB, created.id, { comment: 'Aprobada' }).expect(200);

      for (const cookies of [teacher, coordA, admin]) {
        const rows = await history(cookies, created.id);
        expect(rows.map((row) => row.action)).toEqual(['ajuste', 'observaciones', 'aprobada']);
        expect(rows[0]).toMatchObject({
          comment: null,
          adjustedFields: ['tema'],
          changes: [{ field: 'tema', before: 'Tema original', after: 'Tema de coordinación' }],
          reviewer: { id: coordAUser.id, fullName: expect.any(String) as string },
        });
        expect(rows[1]).toMatchObject({ comment: 'Primera ronda', changes: [] });
        expect(rows[2]).toMatchObject({ comment: 'Aprobada', changes: [] });
        const dates = rows.map((row) => Date.parse(row.date));
        expect(dates).toEqual([...dates].sort((a, b) => a - b));
      }
      expect(JSON.stringify(await history(teacher, created.id))).not.toContain('@');
    });

    it('un docente ajeno recibe 404 al pedir el historial y uno sin revisiones recibe lista vacía', async () => {
      const created = await submitted();

      await as(other, 'get', `/lesson-plans/${created.id}/reviews`).expect(404);
      expect(await history(teacher, created.id)).toEqual([]);
    });
  });

  describe('estados y permisos (R17, R21)', () => {
    it.each([
      RecordStatus.Draft,
      RecordStatus.ChangesRequested,
      RecordStatus.Reviewed,
      RecordStatus.Voided,
    ])('aprobar o devolver una planeación %s responde 409 sin filas ni ajustes', async (status) => {
      const created = await submitted();
      await forceStatus(app, created.id, status);
      const before = await stored(created.id);

      const approved = await approve(coordA, created.id, {
        changes: { topic: 'Otro tema' },
      }).expect(409);
      await giveBack(coordA, created.id, {
        comment: 'Devuelta',
        changes: { topic: 'Otro' },
      }).expect(409);

      expect(apiErrorBodySchema.parse(approved.body).code).toBe(ApiErrorCode.Conflict);
      expect(await stored(created.id)).toEqual(before);
      expect(await reviewRows(created.id)).toEqual([]);
    });

    it('un docente recibe 403 sin_permiso y una planeación inexistente 404', async () => {
      const created = await submitted();

      const res = await approve(teacher, created.id).expect(403);
      await giveBack(teacher, created.id, { comment: 'x' }).expect(403);
      await approve(coordA, '0b9d6c1e-2f4a-4d7e-8a1c-3d6e8f0a1b3c').expect(404);

      expect(apiErrorBodySchema.parse(res.body).code).toBe(ApiErrorCode.Forbidden);
      expect((await stored(created.id)).status).toBe('enviada');
    });

    it.each([
      ['coordinador', () => coordA, () => coordAUser],
      ['administrador', () => admin, () => adminUser],
    ] as const)(
      'el %s dueño de la planeación recibe 403 autorrevision_no_permitida al aprobar o devolver, con o sin ajustes',
      async (_role, cookies, user) => {
        const own = await createPlan(app, cookies(), {
          ...target,
          periodId: planning.periods[1],
          topic: 'Propia',
          ...SUBMITTABLE_CONTENT,
        });
        await as(cookies(), 'post', `/lesson-plans/${own.id}/submit`).expect(200);

        for (const res of [
          await approve(cookies(), own.id),
          await approve(cookies(), own.id, { changes: { topic: 'Ajuste propio' } }),
          await giveBack(cookies(), own.id, { comment: 'x' }),
          await giveBack(cookies(), own.id, { comment: 'x', changes: { topic: 'Ajuste propio' } }),
        ]) {
          expect(res.status).toBe(403);
          expect(apiErrorBodySchema.parse(res.body).code).toBe(ApiErrorCode.SelfReviewForbidden);
        }
        const unchanged = await stored(own.id);
        expect(unchanged).toMatchObject({
          status: 'enviada',
          topic: 'Propia',
          teacherId: user().id,
        });
        expect(await reviewRows(own.id)).toEqual([]);

        // Otra persona de coordinación sí puede revisarla.
        await approve(cookies() === admin ? coordB : admin, own.id).expect(200);
      },
    );

    it('dos decisiones simultáneas sobre la misma planeación producen una sola y un 409', async () => {
      const created = await submitted();

      const approvals = await Promise.all([
        approve(coordA, created.id, { comment: 'A' }),
        approve(coordB, created.id, { comment: 'B' }),
      ]);
      expect(approvals.map((res) => res.status).sort()).toEqual([200, 409]);

      const mixed = await submitted();
      const results = await Promise.all([
        approve(coordA, mixed.id, { changes: { topic: 'Ajuste de A' } }),
        giveBack(coordB, mixed.id, {
          comment: 'Devuelta por B',
          changes: { topic: 'Ajuste de B' },
        }),
      ]);
      expect(results.map((res) => res.status).sort()).toEqual([200, 409]);

      expect((await reviewRows(created.id)).map((row) => row.action)).toHaveLength(1);
      const rows = await reviewRows(mixed.id);
      expect(rows.map((row) => row.action)).toHaveLength(2);
      expect(rows[0]?.action).toBe('ajuste');
      // El «antes» del ajuste es lo que había, no lo que dejó la decisión perdedora.
      expect(rows[0]?.changes).toMatchObject({ tema: { antes: 'Tema original' } });
    });

    it('si falla la escritura de la revisión no queda ni el ajuste, ni el estado, ni la bitácora', async () => {
      const created = await submitted();
      const before = await stored(created.id);
      const auditBefore = await auditRows(app, created.id);
      const spy = jest
        .spyOn(app.get(ReviewsService), 'record')
        .mockRejectedValueOnce(new Error('falla simulada'));

      await approve(coordA, created.id, { changes: { topic: 'Se revierte' } }).expect(500);

      spy.mockRestore();
      expect(await stored(created.id)).toEqual(before);
      expect(await reviewRows(created.id)).toEqual([]);
      expect(await auditRows(app, created.id)).toEqual(auditBefore);
    });
  });
});
