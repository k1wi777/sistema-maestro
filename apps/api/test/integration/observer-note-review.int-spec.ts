import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, ApiErrorCode, RecordStatus, UserRole } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import {
  call,
  createNote,
  freshGrade,
  reviewRows,
  submittedNote,
  unknownId,
  type NoteBody,
  type ReviewBody,
} from './support/formats';
import { auditRows, setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { createTestUser, signIn, type Cookies, type TestUser } from './support/session';

describe('revisión y anulación del observador (BE-64)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let teacher: Cookies;
  let other: Cookies;
  let coordUser: TestUser;
  let coordA: Cookies;
  let coordB: Cookies;
  let adminUser: TestUser;
  let admin: Cookies;

  const post = (cookies: Cookies, path: string) => call(app, cookies, 'post', path);
  const approve = (cookies: Cookies, id: string, body: Record<string, unknown> = {}) =>
    post(cookies, `/observer-notes/${id}/approve`).send(body);
  const giveBack = (cookies: Cookies, id: string, body: Record<string, unknown>) =>
    post(cookies, `/observer-notes/${id}/return`).send(body);
  const voidNote = (cookies: Cookies, id: string, reason = 'Anotación duplicada') =>
    post(cookies, `/observer-notes/${id}/void`).send({ reason });
  const stored = (id: string) => prisma.observerNote.findUniqueOrThrow({ where: { id } });
  const submitted = (extra: Record<string, unknown> = {}) =>
    submittedNote(app, planning, teacher, extra);

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    teacher = await signIn(app, await createTestUser(app));
    other = await signIn(app, await createTestUser(app));
    coordUser = await createTestUser(app, { role: UserRole.Coordinator });
    coordA = await signIn(app, coordUser);
    coordB = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
    adminUser = await createTestUser(app, { role: UserRole.Administrator });
    admin = await signIn(app, adminUser);
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  describe('aprobar y devolver (R11, R12, R20)', () => {
    it('aprueba una enviada: revisada, una fila aprobada y bitácora de coordinación', async () => {
      const created = await submitted();

      const res = await approve(coordA, created.id, { comment: 'Gracias por el registro' }).expect(
        200,
      );

      expect((res.body as NoteBody).status).toBe(RecordStatus.Reviewed);
      expect(await reviewRows(app, created.id)).toMatchObject([
        {
          recordType: 'observador',
          action: 'aprobada',
          comment: 'Gracias por el registro',
          reviewerId: coordUser.id,
          adjustedFields: [],
          changes: null,
        },
      ]);
      expect((await auditRows(app, created.id)).at(-1)).toMatchObject({
        action: 'Aprobó una anotación del observador',
        type: 'observador',
        role: 'coordinador',
      });
    });

    it('el administrador también revisa; devolver exige comentario y deja observaciones', async () => {
      const created = await submitted();
      await giveBack(admin, created.id, {}).expect(400);

      const res = await giveBack(admin, created.id, { comment: 'Precisa la situación' }).expect(
        200,
      );

      expect((res.body as NoteBody).status).toBe(RecordStatus.ChangesRequested);
      expect((await reviewRows(app, created.id))[0]).toMatchObject({
        action: 'observaciones',
        reviewerId: adminUser.id,
      });
      expect((await auditRows(app, created.id)).at(-1)).toMatchObject({
        action: 'Dejó observaciones en una anotación del observador',
      });
    });

    it('un docente no revisa (403); una anotación no enviada responde 409 sin modificarla', async () => {
      const created = await submitted();
      await approve(teacher, created.id).expect(403);
      await giveBack(teacher, created.id, { comment: 'x' }).expect(403);

      const draft = await createNote(app, teacher, {
        gradeId: (await freshGrade(planning, [])).gradeId,
      });
      await approve(coordA, draft.id).expect(409);
      expect((await stored(draft.id)).status).toBe(RecordStatus.Draft);

      await approve(coordA, created.id).expect(200);
      await giveBack(coordB, created.id, { comment: 'x' }).expect(409);
      expect(await reviewRows(app, created.id)).toHaveLength(1);
    });

    it('un coordinador o administrador dueño no puede revisar su propia anotación', async () => {
      for (const [cookies, reviewer] of [
        [coordA, coordB],
        [admin, coordA],
      ] as const) {
        const own = await submittedNote(app, planning, cookies);

        for (const res of [
          await approve(cookies, own.id).expect(403),
          await giveBack(cookies, own.id, { comment: 'x' }).expect(403),
        ]) {
          expect(apiErrorBodySchema.parse(res.body).code).toBe(ApiErrorCode.SelfReviewForbidden);
        }
        expect((await stored(own.id)).status).toBe(RecordStatus.Submitted);
        expect(await reviewRows(app, own.id)).toHaveLength(0);
        await approve(reviewer, own.id).expect(200);
      }
    });

    it('dos decisiones simultáneas producen una sola y un 409', async () => {
      const created = await submitted();

      const results = await Promise.all([
        approve(coordA, created.id, { comment: 'A' }),
        giveBack(coordB, created.id, { comment: 'B' }),
      ]);

      expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
      expect(await reviewRows(app, created.id)).toHaveLength(1);
    });
  });

  describe('ajustes (R11, R14)', () => {
    it('reclasificar el tipo guarda el valor anterior y el nuevo y el historial lo muestra al dueño', async () => {
      const created = await submitted({ type: 'tipo_i', studentFirstName: 'Beto' });

      const res = await giveBack(coordA, created.id, {
        comment: 'La reclasifiqué',
        changes: { type: 'tipo_ii', followUp: 'Citar a la familia', familyInformed: true },
      }).expect(200);

      expect(res.body).toMatchObject({
        type: 'tipo_ii',
        followUp: 'Citar a la familia',
        familyInformed: true,
        status: RecordStatus.ChangesRequested,
      });
      const rows = await reviewRows(app, created.id);
      expect(rows.map((row) => row.action)).toEqual(['ajuste', 'observaciones']);
      expect([...(rows[0]?.adjustedFields ?? [])].sort()).toEqual([
        'familia_informada',
        'seguimiento',
        'tipo',
      ]);
      expect(rows[0]?.changes).toEqual({
        tipo: { antes: 'tipo_i', despues: 'tipo_ii' },
        seguimiento: { antes: null, despues: 'Citar a la familia' },
        familia_informada: { antes: false, despues: true },
      });

      for (const cookies of [teacher, coordB]) {
        const history = (
          await call(app, cookies, 'get', `/observer-notes/${created.id}/reviews`).expect(200)
        ).body as ReviewBody[];
        expect(history.map((row) => row.action)).toEqual(['ajuste', 'observaciones']);
        expect(history[0]?.changes).toEqual(
          expect.arrayContaining([{ field: 'tipo', before: 'tipo_i', after: 'tipo_ii' }]),
        );
      }
      await call(app, other, 'get', `/observer-notes/${created.id}/reviews`).expect(404);
    });

    it('un ajuste sin cambio efectivo, con grado o con un nombre inválido responde 400 sin aplicar nada', async () => {
      const created = await submitted({ studentFirstName: 'Caro' });

      const sinCambio = await approve(coordA, created.id, {
        changes: { studentFirstName: 'Caro' },
      }).expect(400);
      expect(apiErrorBodySchema.parse(sinCambio.body).errors?.map((e) => e.field)).toEqual([
        'changes',
      ]);
      await approve(coordA, created.id, { changes: { gradeId: unknownId() } }).expect(400);
      await approve(coordA, created.id, { changes: {} }).expect(400);
      const nombre = await approve(coordA, created.id, {
        changes: { studentFirstName: 'Caro Pérez Gómez' },
      }).expect(400);
      expect(JSON.stringify(nombre.body)).not.toContain('Gómez');

      expect((await stored(created.id)).status).toBe(RecordStatus.Submitted);
      expect(await reviewRows(app, created.id)).toHaveLength(0);
    });
  });

  describe('anular (R13)', () => {
    it('el dueño anula desde borrador y enviada y el motivo queda en la bitácora', async () => {
      const sent = await submitted();
      const res = await voidNote(teacher, sent.id, 'Estudiante equivocado').expect(200);

      expect((res.body as NoteBody).status).toBe(RecordStatus.Voided);
      expect((await auditRows(app, sent.id)).at(-1)).toMatchObject({
        action: 'Anuló una anotación del observador',
        detail: 'Estudiante equivocado',
      });
      expect(await prisma.observerNote.count({ where: { id: sent.id } })).toBe(1);

      const draft = await createNote(app, teacher, {
        gradeId: (await freshGrade(planning, [])).gradeId,
      });
      await voidNote(teacher, draft.id).expect(200);
    });

    it('revisada solo la anula coordinación; anulada no se anula de nuevo; un tercero no la ve', async () => {
      const created = await submitted();
      await approve(coordA, created.id).expect(200);

      await voidNote(teacher, created.id).expect(409);
      await voidNote(other, created.id).expect(404);
      await voidNote(coordB, created.id, 'Revisada por equivocación').expect(200);
      await voidNote(coordB, created.id).expect(409);
      expect((await stored(created.id)).status).toBe(RecordStatus.Voided);
    });

    it('el motivo es obligatorio de 3 a 300 caracteres y una anotación inexistente responde 404', async () => {
      const created = await submitted();
      await post(coordA, `/observer-notes/${created.id}/void`).send({}).expect(400);
      await voidNote(coordA, created.id, 'ab').expect(400);
      await voidNote(coordA, created.id, 'x'.repeat(301)).expect(400);
      await voidNote(coordA, unknownId()).expect(404);
      await approve(coordA, unknownId()).expect(404);
    });
  });
});
