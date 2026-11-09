import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, ApiErrorCode, RecordStatus, UserRole } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import {
  addEntry,
  call,
  createJournal,
  freshGrade,
  reviewRows,
  submittedJournal,
  unknownId,
  type JournalBody,
  type ReviewBody,
} from './support/formats';
import { auditRows, setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { createTestUser, signIn, type Cookies, type TestUser } from './support/session';

describe('revisión y anulación del diario de campo (BE-62)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let teacherUser: TestUser;
  let teacher: Cookies;
  let other: Cookies;
  let coordUser: TestUser;
  let coordA: Cookies;
  let coordB: Cookies;
  let adminUser: TestUser;
  let admin: Cookies;

  const post = (cookies: Cookies, path: string) => call(app, cookies, 'post', path);
  const approve = (cookies: Cookies, id: string, body: Record<string, unknown> = {}) =>
    post(cookies, `/field-journals/${id}/approve`).send(body);
  const giveBack = (cookies: Cookies, id: string, body: Record<string, unknown>) =>
    post(cookies, `/field-journals/${id}/return`).send(body);
  const voidJournal = (cookies: Cookies, id: string, reason = 'Hoja creada por error') =>
    post(cookies, `/field-journals/${id}/void`).send({ reason });
  const history = async (cookies: Cookies, id: string) =>
    (await call(app, cookies, 'get', `/field-journals/${id}/reviews`).expect(200))
      .body as ReviewBody[];
  const stored = (id: string) => prisma.fieldJournal.findUniqueOrThrow({ where: { id } });
  const submitted = (entries?: Record<string, unknown>[]) =>
    submittedJournal(app, planning, teacherUser, teacher, entries);

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    teacherUser = await createTestUser(app);
    teacher = await signIn(app, teacherUser);
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

  describe('aprobar y devolver (R6, R20)', () => {
    it('aprueba una enviada: revisada, una fila aprobada y bitácora de coordinación', async () => {
      const journal = await submitted();

      const res = await approve(coordA, journal.id, { comment: 'Buen registro' }).expect(200);

      expect((res.body as JournalBody).status).toBe(RecordStatus.Reviewed);
      expect(await reviewRows(app, journal.id)).toMatchObject([
        {
          recordType: 'diario',
          action: 'aprobada',
          comment: 'Buen registro',
          reviewerId: coordUser.id,
          adjustedFields: [],
          changes: null,
        },
      ]);
      const audit = (await auditRows(app, journal.id)).at(-1);
      expect(audit).toMatchObject({
        action: 'Aprobó un diario de campo',
        type: 'diario',
        role: 'coordinador',
        userId: coordUser.id,
      });
      expect(audit?.dataBefore).toMatchObject({ status: 'enviada' });
      expect(audit?.dataAfter).toMatchObject({ status: 'revisada' });
    });

    it('el administrador también revisa y el comentario al aprobar es opcional', async () => {
      const journal = await submitted();
      await approve(admin, journal.id).expect(200);
      expect((await reviewRows(app, journal.id))[0]).toMatchObject({
        action: 'aprobada',
        comment: null,
        reviewerId: adminUser.id,
      });
    });

    it('devolver exige comentario, deja observaciones y el dueño puede corregir y reenviar', async () => {
      const journal = await submitted();
      await giveBack(coordA, journal.id, {}).expect(400);

      const res = await giveBack(coordA, journal.id, { comment: 'Falta reflexión' }).expect(200);
      expect((res.body as JournalBody).status).toBe(RecordStatus.ChangesRequested);
      expect((await auditRows(app, journal.id)).at(-1)).toMatchObject({
        action: 'Dejó observaciones en un diario de campo',
      });

      const entryId = (res.body as JournalBody).entries[0]?.id ?? '';
      await call(app, teacher, 'patch', `/field-journals/${journal.id}/entries/${entryId}`)
        .send({ reflection: 'Ya la agregué' })
        .expect(200);
      await post(teacher, `/field-journals/${journal.id}/submit`).expect(200);
      expect((await stored(journal.id)).status).toBe(RecordStatus.Submitted);
    });

    it('un docente no revisa (403) y una hoja que no está enviada responde 409 sin modificarla', async () => {
      const journal = await submitted();
      await approve(teacher, journal.id).expect(403);
      await giveBack(teacher, journal.id, { comment: 'x' }).expect(403);

      const { gradeId } = await freshGrade(planning, [teacherUser.id]);
      const draft = await createJournal(app, teacher, { gradeId, periodId: planning.periods[1] });
      await approve(coordA, draft.id).expect(409);
      await giveBack(coordA, draft.id, { comment: 'x' }).expect(409);
      expect((await stored(draft.id)).status).toBe(RecordStatus.Draft);
      expect(await reviewRows(app, draft.id)).toHaveLength(0);

      await approve(coordA, journal.id).expect(200);
      await approve(coordB, journal.id).expect(409);
    });

    it('un coordinador o administrador dueño no puede revisar su propia hoja (403 autorrevision_no_permitida)', async () => {
      for (const [cookies, user] of [
        [coordA, coordUser],
        [admin, adminUser],
      ] as const) {
        const { gradeId } = await freshGrade(planning, [user.id]);
        const own = await createJournal(app, cookies, { gradeId, periodId: planning.periods[1] });
        await addEntry(app, cookies, own.id);
        await post(cookies, `/field-journals/${own.id}/submit`).expect(200);

        for (const res of [
          await approve(cookies, own.id).expect(403),
          await giveBack(cookies, own.id, { comment: 'x' }).expect(403),
        ]) {
          expect(apiErrorBodySchema.parse(res.body).code).toBe(ApiErrorCode.SelfReviewForbidden);
        }
        expect((await stored(own.id)).status).toBe(RecordStatus.Submitted);
        expect(await reviewRows(app, own.id)).toHaveLength(0);
        // Otra persona de coordinación sí puede.
        await approve(cookies === coordA ? coordB : coordA, own.id).expect(200);
      }
    });

    it('dos decisiones simultáneas producen una sola y un 409', async () => {
      const journal = await submitted();

      const results = await Promise.all([
        approve(coordA, journal.id, { comment: 'A' }),
        giveBack(coordB, journal.id, { comment: 'B' }),
      ]);

      expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
      expect(await reviewRows(app, journal.id)).toHaveLength(1);
    });

    it('un envío y un alta de entrada simultáneos no dejan una entrada fuera del envío', async () => {
      const journal = await submitted().then(async (sent) => {
        await prisma.fieldJournal.update({
          where: { id: sent.id },
          data: { status: RecordStatus.ChangesRequested },
        });
        return sent;
      });

      const [sendRes, addRes] = await Promise.all([
        post(teacher, `/field-journals/${journal.id}/submit`),
        post(teacher, `/field-journals/${journal.id}/entries`).send({
          date: '2031-03-20',
          lesson: 'Arte',
          eventType: 'grupo',
          description: 'Entrada simultánea',
        }),
      ]);

      expect(sendRes.status).toBe(200);
      expect([201, 409]).toContain(addRes.status);
      const entries = await prisma.fieldJournalEntry.count({ where: { journalId: journal.id } });
      expect(entries).toBe(addRes.status === 201 ? 2 : 1);
      expect((await stored(journal.id)).status).toBe(RecordStatus.Submitted);
    });
  });

  describe('ajustes de entradas (R7, R14)', () => {
    it('ajusta dos entradas al devolver: filas ajuste + decisión con claves entradas.<id>.<columna>', async () => {
      const journal = await submitted([
        { description: 'Descripción uno', students: ['Ana', 'Luis'], date: '2031-03-10' },
        { description: 'Descripción dos', lesson: 'Arte', date: '2031-03-11' },
      ]);
      const [first, second] = (
        await prisma.fieldJournalEntry.findMany({
          where: { journalId: journal.id },
          orderBy: { date: 'asc' },
        })
      ).map((row) => row.id);

      const res = await giveBack(coordA, journal.id, {
        comment: 'Ajusté dos registros',
        changes: {
          entries: [
            { id: first, description: 'Descripción corregida', students: ['Ana'] },
            { id: second, eventType: 'positivo', reflection: 'Reflexión agregada' },
          ],
        },
      }).expect(200);

      const body = res.body as JournalBody;
      expect(body.status).toBe(RecordStatus.ChangesRequested);
      expect(body.entries.find((e) => e.id === first)).toMatchObject({
        description: 'Descripción corregida',
        students: ['Ana'],
      });
      const rows = await reviewRows(app, journal.id);
      expect(rows.map((row) => row.action)).toEqual(['ajuste', 'observaciones']);
      expect([...(rows[0]?.adjustedFields ?? [])].sort()).toEqual(
        [
          `entradas.${first}.descripcion`,
          `entradas.${first}.estudiantes`,
          `entradas.${second}.reflexion`,
          `entradas.${second}.tipo_evento`,
        ].sort(),
      );
      expect(rows[0]?.changes).toMatchObject({
        [`entradas.${first}.descripcion`]: {
          antes: 'Descripción uno',
          despues: 'Descripción corregida',
        },
        [`entradas.${first}.estudiantes`]: { antes: 'Ana, Luis', despues: 'Ana' },
        [`entradas.${second}.tipo_evento`]: { antes: 'grupo', despues: 'positivo' },
        [`entradas.${second}.reflexion`]: { antes: null, despues: 'Reflexión agregada' },
      });
      expect(rows[1]).toMatchObject({ comment: 'Ajusté dos registros', adjustedFields: [] });
    });

    it('el historial llega al dueño y a coordinación con cada ajuste antes de su decisión; un tercero no lo ve', async () => {
      const journal = await submitted();
      const entryId = (
        await prisma.fieldJournalEntry.findFirstOrThrow({ where: { journalId: journal.id } })
      ).id;
      await approve(coordA, journal.id, {
        changes: { entries: [{ id: entryId, lesson: 'Lengua' }] },
      }).expect(200);

      for (const cookies of [teacher, coordB, admin]) {
        const rows = await history(cookies, journal.id);
        expect(rows.map((r) => r.action)).toEqual(['ajuste', 'aprobada']);
        expect(rows[0]).toMatchObject({
          adjustedFields: [`entradas.${entryId}.clase`],
          changes: [{ field: `entradas.${entryId}.clase`, before: 'Matemáticas', after: 'Lengua' }],
        });
        expect(rows[0]?.reviewer.id).toBe(coordUser.id);
      }
      await call(app, other, 'get', `/field-journals/${journal.id}/reviews`).expect(404);
    });

    it('una entrada ajena, repetida o sin cambio efectivo responde 400 sin aplicar nada', async () => {
      const journal = await submitted();
      const foreign = await submitted();
      const entryId = (
        await prisma.fieldJournalEntry.findFirstOrThrow({ where: { journalId: journal.id } })
      ).id;
      const foreignEntry = (
        await prisma.fieldJournalEntry.findFirstOrThrow({ where: { journalId: foreign.id } })
      ).id;

      const ajena = await approve(coordA, journal.id, {
        changes: {
          entries: [
            { id: entryId, lesson: 'Lengua' },
            { id: foreignEntry, lesson: 'Otra' },
          ],
        },
      }).expect(400);
      expect(apiErrorBodySchema.parse(ajena.body).errors?.map((e) => e.field)).toEqual([
        'changes.entries.1.id',
      ]);

      const sinCambio = await giveBack(coordA, journal.id, {
        comment: 'x',
        changes: { entries: [{ id: entryId, lesson: 'Matemáticas' }] },
      }).expect(400);
      expect(apiErrorBodySchema.parse(sinCambio.body).errors?.map((e) => e.field)).toEqual([
        'changes',
      ]);

      await approve(coordA, journal.id, {
        changes: {
          entries: [
            { id: entryId, lesson: 'A' },
            { id: entryId, lesson: 'B' },
          ],
        },
      }).expect(400);
      await approve(coordA, journal.id, { changes: { entries: [{ id: entryId }] } }).expect(400);
      await approve(coordA, journal.id, { changes: { entries: [] } }).expect(400);
      const mejorar = await approve(coordA, journal.id, {
        changes: { entries: [{ id: entryId, eventType: 'mejorar' }] },
      }).expect(400);
      expect(apiErrorBodySchema.parse(mejorar.body).errors?.map((e) => e.field)).toEqual([
        'changes.entries.0.actions',
      ]);
      await approve(coordA, journal.id, {
        changes: { entries: [{ id: entryId, students: ['María del Carmen'] }] },
      }).expect(400);

      expect((await stored(journal.id)).status).toBe(RecordStatus.Submitted);
      expect(
        (await prisma.fieldJournalEntry.findUniqueOrThrow({ where: { id: entryId } })).lesson,
      ).toBe('Matemáticas');
      expect(await reviewRows(app, journal.id)).toHaveLength(0);
      expect((await auditRows(app, journal.id)).map((r) => r.action)).not.toContain(
        'Aprobó un diario de campo',
      );
    });
  });

  describe('anular (R13)', () => {
    it('el dueño anula desde borrador y enviada y el motivo queda en la bitácora', async () => {
      const sent = await submitted();
      const res = await voidJournal(teacher, sent.id, 'Grado equivocado').expect(200);

      expect((res.body as JournalBody).status).toBe(RecordStatus.Voided);
      expect((await auditRows(app, sent.id)).at(-1)).toMatchObject({
        action: 'Anuló un diario de campo',
        detail: 'Grado equivocado',
      });
      expect(await prisma.fieldJournal.count({ where: { id: sent.id } })).toBe(1);

      const { gradeId } = await freshGrade(planning, [teacherUser.id]);
      const draft = await createJournal(app, teacher, { gradeId, periodId: planning.periods[1] });
      await voidJournal(teacher, draft.id).expect(200);
    });

    it('revisada solo la anula coordinación; anulada no se anula de nuevo', async () => {
      const journal = await submitted();
      await approve(coordA, journal.id).expect(200);

      await voidJournal(teacher, journal.id).expect(409);
      await voidJournal(other, journal.id).expect(404);
      await voidJournal(coordB, journal.id, 'Revisada por equivocación').expect(200);
      await voidJournal(coordB, journal.id).expect(409);
      await voidJournal(teacher, journal.id).expect(409);
      expect((await stored(journal.id)).status).toBe(RecordStatus.Voided);
    });

    it('coordinación anula una hoja ajena en borrador; el motivo es obligatorio de 3 a 300 caracteres', async () => {
      const { gradeId } = await freshGrade(planning, [teacherUser.id]);
      const draft = await createJournal(app, teacher, { gradeId, periodId: planning.periods[1] });

      await post(coordA, `/field-journals/${draft.id}/void`).send({}).expect(400);
      await voidJournal(coordA, draft.id, 'ab').expect(400);
      await voidJournal(coordA, draft.id, 'x'.repeat(301)).expect(400);
      await voidJournal(coordA, draft.id, 'Duplicada').expect(200);
    });

    it('una hoja inexistente responde 404 en todas las rutas de acción', async () => {
      const id = unknownId();
      await approve(coordA, id).expect(404);
      await giveBack(coordA, id, { comment: 'x' }).expect(404);
      await voidJournal(coordA, id).expect(404);
      await post(teacher, `/field-journals/${id}/submit`).expect(404);
    });
  });
});
