import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, RecordStatus, UserRole } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import {
  addEntry,
  call,
  createJournal,
  ENTRY_CONTENT,
  forceJournalStatus,
  freshGrade,
  unknownId,
  type JournalBody,
} from './support/formats';
import { auditRows, setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { createTestUser, signIn, type Cookies, type TestUser } from './support/session';

type Page = { items: JournalBody[]; totalItems: number; page: number; totalPages: number };

describe('diario de campo (BE-61)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let teacherUser: TestUser;
  let teacher: Cookies;
  let other: Cookies;
  let otherUser: TestUser;
  let coord: Cookies;
  let admin: Cookies;

  const get = (cookies: Cookies, path: string) => call(app, cookies, 'get', path);
  const post = (cookies: Cookies, path: string) => call(app, cookies, 'post', path);
  const errorOf = (body: unknown) => apiErrorBodySchema.parse(body);

  /** Hoja nueva del docente en un grado y periodo propios. */
  async function freshJournal(periodNumber: 1 | 2 | 3 = 1): Promise<JournalBody> {
    const { gradeId } = await freshGrade(planning, [teacherUser.id]);
    return createJournal(app, teacher, { gradeId, periodId: planning.periods[periodNumber] });
  }

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    teacherUser = await createTestUser(app);
    teacher = await signIn(app, teacherUser);
    otherUser = await createTestUser(app);
    other = await signIn(app, otherUser);
    coord = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
    admin = await signIn(app, await createTestUser(app, { role: UserRole.Administrator }));
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  describe('crear la hoja (R1, R2)', () => {
    it('crea en borrador, sin entradas y con el docente de la sesión, y lo deja en la bitácora', async () => {
      const journal = await freshJournal();

      expect(journal).toMatchObject({
        status: RecordStatus.Draft,
        teacher: { id: teacherUser.id },
        period: { id: planning.periods[1], schoolYear: planning.year },
        entries: [],
        entryCount: 0,
        submittedAt: null,
      });
      const rows = await auditRows(app, journal.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: 'diario',
        entity: 'diario_campo',
        action: 'Creó una hoja de diario de campo',
        userId: teacherUser.id,
        dataBefore: null,
      });
    });

    it('responde 403 si el grado no es de una asignación activa del docente', async () => {
      const { gradeId } = await planning.gradeAndArea('Primaria');
      const res = await post(teacher, '/field-journals')
        .send({ gradeId, periodId: planning.periods[1] })
        .expect(403);
      expect(errorOf(res.body).message).toMatch(/asignación activa/);

      const retired = await planning.gradeAndArea('Primaria');
      await planning.assign(teacherUser.id, retired.gradeId, retired.areaId, 'retirada');
      await post(teacher, '/field-journals')
        .send({ gradeId: retired.gradeId, periodId: planning.periods[1] })
        .expect(403);
    });

    it('responde 400 con el campo periodId si el periodo no existe o es de otro año', async () => {
      const { gradeId } = await freshGrade(planning, [teacherUser.id]);
      for (const periodId of [unknownId(), planning.otherYearPeriodId]) {
        const res = await post(teacher, '/field-journals').send({ gradeId, periodId }).expect(400);
        expect(errorOf(res.body).errors?.map((e) => e.field)).toEqual(['periodId']);
      }
    });

    it('rechaza campos desconocidos y una hoja con estado o docente en el cuerpo', async () => {
      const { gradeId } = await freshGrade(planning, [teacherUser.id]);
      await post(teacher, '/field-journals')
        .send({ gradeId, periodId: planning.periods[1], status: 'revisada' })
        .expect(400);
      await post(teacher, '/field-journals')
        .send({ gradeId, periodId: planning.periods[1], teacherId: otherUser.id })
        .expect(400);
    });

    it('responde 409 al repetir la combinación, también con la hoja anulada', async () => {
      const journal = await freshJournal();
      const body = { gradeId: await gradeOf(journal.id), periodId: planning.periods[1] };

      await post(teacher, '/field-journals').send(body).expect(409);
      await post(teacher, `/field-journals/${journal.id}/void`)
        .send({ reason: 'Hoja creada por error' })
        .expect(200);
      const res = await post(teacher, '/field-journals').send(body).expect(409);

      expect(errorOf(res.body).message).toMatch(/anulada/);
      expect(
        await prisma.fieldJournal.count({
          where: { teacherId: teacherUser.id, gradeId: body.gradeId },
        }),
      ).toBe(1);
    });

    it('dos altas simultáneas de la misma combinación dejan una hoja y un 409', async () => {
      const { gradeId } = await freshGrade(planning, [teacherUser.id]);
      const body = { gradeId, periodId: planning.periods[2] };

      const results = await Promise.all([
        post(teacher, '/field-journals').send(body),
        post(teacher, '/field-journals').send(body),
      ]);

      expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
      expect(
        await prisma.fieldJournal.count({ where: { teacherId: teacherUser.id, gradeId } }),
      ).toBe(1);
    });

    it('otro docente puede tener su propia hoja del mismo grado y periodo', async () => {
      const { gradeId } = await freshGrade(planning, [teacherUser.id, otherUser.id]);
      const body = { gradeId, periodId: planning.periods[1] };

      await post(teacher, '/field-journals').send(body).expect(201);
      await post(other, '/field-journals').send(body).expect(201);
    });

    async function gradeOf(journalId: string): Promise<string> {
      return (await prisma.fieldJournal.findUniqueOrThrow({ where: { id: journalId } })).gradeId;
    }
  });

  describe('entradas (R3, R4, R5, R16)', () => {
    it('el dueño agrega, edita y quita entradas en borrador y la hoja las devuelve ordenadas', async () => {
      const journal = await freshJournal();

      const added = await addEntry(app, teacher, journal.id, {
        date: '2031-03-12',
        students: ['María José', 'Luis'],
        actions: 'Repasar',
        reflection: 'Funcionó bien',
      });
      await addEntry(app, teacher, journal.id, { date: '2031-03-11' });
      const detail = (await get(teacher, `/field-journals/${journal.id}`).expect(200))
        .body as JournalBody;

      expect(detail.entryCount).toBe(2);
      expect(detail.entries.map((e) => e.date)).toEqual(['2031-03-11', '2031-03-12']);
      expect(detail.entries[1]).toMatchObject({
        students: ['María José', 'Luis'],
        actions: 'Repasar',
        reflection: 'Funcionó bien',
      });
      expect(new Date(detail.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(journal.updatedAt).getTime(),
      );

      const entryId = added.entries[0]?.id ?? '';
      const edited = await call(
        app,
        teacher,
        'patch',
        `/field-journals/${journal.id}/entries/${entryId}`,
      )
        .send({ description: 'Texto editado', actions: null, students: [] })
        .expect(200);
      expect((edited.body as JournalBody).entries.find((e) => e.id === entryId)).toMatchObject({
        description: 'Texto editado',
        actions: null,
        students: [],
        lesson: 'Matemáticas',
      });

      const removed = await call(
        app,
        teacher,
        'delete',
        `/field-journals/${journal.id}/entries/${entryId}`,
      ).expect(200);
      expect((removed.body as JournalBody).entryCount).toBe(1);
      expect(await prisma.fieldJournalEntry.count({ where: { id: entryId } })).toBe(0);
      expect(await prisma.fieldJournal.count({ where: { id: journal.id } })).toBe(1);
    });

    it('cada escritura de entradas queda en la bitácora de la hoja', async () => {
      const journal = await freshJournal();
      const added = await addEntry(app, teacher, journal.id);
      const entryId = added.entries[0]?.id ?? '';
      await call(app, teacher, 'patch', `/field-journals/${journal.id}/entries/${entryId}`)
        .send({ lesson: 'Arte' })
        .expect(200);
      await call(app, teacher, 'delete', `/field-journals/${journal.id}/entries/${entryId}`).expect(
        200,
      );

      expect((await auditRows(app, journal.id)).map((row) => row.action)).toEqual([
        'Creó una hoja de diario de campo',
        'Agregó un registro al diario de campo',
        'Editó un registro del diario de campo',
        'Quitó un registro del diario de campo',
      ]);
    });

    it('exige fecha, clase, tipo y descripción y acciones si el evento es «a mejorar»', async () => {
      const journal = await freshJournal();
      const path = `/field-journals/${journal.id}/entries`;

      for (const missing of ['date', 'lesson', 'eventType', 'description']) {
        const body: Record<string, unknown> = { ...ENTRY_CONTENT };
        delete body[missing];
        await post(teacher, path).send(body).expect(400);
      }
      const res = await post(teacher, path)
        .send({ ...ENTRY_CONTENT, eventType: 'mejorar' })
        .expect(400);
      expect(errorOf(res.body).errors?.map((e) => e.field)).toEqual(['actions']);

      const ok = await addEntry(app, teacher, journal.id, {
        eventType: 'mejorar',
        actions: 'Plan',
      });
      const entryId = ok.entries[0]?.id ?? '';
      const patch = await call(app, teacher, 'patch', `${path}/${entryId}`)
        .send({ actions: null })
        .expect(400);
      expect(errorOf(patch.body).errors?.map((e) => e.field)).toEqual(['actions']);
      expect(await prisma.fieldJournalEntry.count({ where: { journalId: journal.id } })).toBe(1);
    });

    it('valida los estudiantes: solo nombres de pila, sin repetir y con tope, sin eco del valor', async () => {
      const journal = await freshJournal();
      const path = `/field-journals/${journal.id}/entries`;
      const bad: Record<string, unknown>[] = [
        { students: ['María del Carmen'] },
        { students: ['Ana', 'ana'] },
        { students: ['Ana3'] },
        { students: ['1023456789'] },
        { students: Array.from({ length: 13 }, (_, i) => `Ab${'cdefghijklmnop'[i]}`) },
        { students: 'Ana, Luis' },
      ];

      for (const extra of bad) {
        const res = await post(teacher, path)
          .send({ ...ENTRY_CONTENT, ...extra })
          .expect(400);
        const fields = errorOf(res.body).errors?.map((e) => e.field) ?? [];
        expect(fields.every((f) => f === 'students' || f.startsWith('students.'))).toBe(true);
        expect(JSON.stringify(res.body)).not.toMatch(/Carmen|1023456789|Ana3/);
      }
      expect(await prisma.fieldJournalEntry.count({ where: { journalId: journal.id } })).toBe(0);
    });

    it('en observaciones el dueño puede seguir editando; en enviada o revisada responde 409', async () => {
      const journal = await freshJournal();
      const created = await addEntry(app, teacher, journal.id);
      const entryId = created.entries[0]?.id ?? '';
      const path = `/field-journals/${journal.id}/entries`;

      await forceJournalStatus(app, journal.id, RecordStatus.ChangesRequested);
      await addEntry(app, teacher, journal.id);

      for (const status of [RecordStatus.Submitted, RecordStatus.Reviewed, RecordStatus.Voided]) {
        await forceJournalStatus(app, journal.id, status);
        await post(teacher, path).send(ENTRY_CONTENT).expect(409);
        await call(app, teacher, 'patch', `${path}/${entryId}`)
          .send({ lesson: 'Arte' })
          .expect(409);
        await call(app, teacher, 'delete', `${path}/${entryId}`).expect(409);
      }
      expect(await prisma.fieldJournalEntry.count({ where: { journalId: journal.id } })).toBe(2);
    });

    it('quien no es el dueño recibe 404 si no ve la hoja y 403 si la ve (coordinación)', async () => {
      const journal = await freshJournal();
      const created = await addEntry(app, teacher, journal.id);
      const entryId = created.entries[0]?.id ?? '';
      const path = `/field-journals/${journal.id}/entries`;

      await post(other, path).send(ENTRY_CONTENT).expect(404);
      for (const cookies of [coord, admin]) {
        await post(cookies, path).send(ENTRY_CONTENT).expect(403);
        await call(app, cookies, 'patch', `${path}/${entryId}`)
          .send({ lesson: 'Arte' })
          .expect(403);
        await call(app, cookies, 'delete', `${path}/${entryId}`).expect(403);
        await post(cookies, `/field-journals/${journal.id}/submit`).expect(403);
      }
    });

    it('una entrada que no es de la hoja de la ruta responde 404', async () => {
      const a = await freshJournal();
      const b = await freshJournal();
      const entryOfB = (await addEntry(app, teacher, b.id)).entries[0]?.id ?? '';

      await call(app, teacher, 'patch', `/field-journals/${a.id}/entries/${entryOfB}`)
        .send({ lesson: 'Arte' })
        .expect(404);
      await call(app, teacher, 'delete', `/field-journals/${a.id}/entries/${entryOfB}`).expect(404);
      await call(app, teacher, 'patch', `/field-journals/${a.id}/entries/${unknownId()}`)
        .send({ lesson: 'Arte' })
        .expect(404);
      expect(await prisma.fieldJournalEntry.count({ where: { id: entryOfB } })).toBe(1);
    });
  });

  describe('enviar (R4, R5)', () => {
    it('sin entradas responde 400 con el campo entries; con una pasa a enviada con fecha de envío', async () => {
      const journal = await freshJournal();

      const res = await post(teacher, `/field-journals/${journal.id}/submit`).expect(400);
      expect(errorOf(res.body).errors?.map((e) => e.field)).toEqual(['entries']);

      await addEntry(app, teacher, journal.id);
      const sent = (await post(teacher, `/field-journals/${journal.id}/submit`).expect(200))
        .body as JournalBody;
      expect(sent.status).toBe(RecordStatus.Submitted);
      expect(sent.submittedAt).not.toBeNull();
      expect((await auditRows(app, journal.id)).at(-1)).toMatchObject({
        action: 'Envió el diario de campo',
      });
    });

    it('una hoja que no está en borrador u observaciones responde 409 sin modificarla', async () => {
      const journal = await freshJournal();
      await addEntry(app, teacher, journal.id);
      await post(teacher, `/field-journals/${journal.id}/submit`).expect(200);

      await post(teacher, `/field-journals/${journal.id}/submit`).expect(409);
      expect(
        (await prisma.fieldJournal.findUniqueOrThrow({ where: { id: journal.id } })).status,
      ).toBe(RecordStatus.Submitted);
    });
  });

  describe('visibilidad, listado y filtros (R20, R21)', () => {
    it('un docente ve solo sus hojas y su filtro de docente se ignora; coordinación ve todas', async () => {
      const mine = await freshJournal();
      const { gradeId } = await freshGrade(planning, [otherUser.id]);
      const theirs = await createJournal(app, other, { gradeId, periodId: planning.periods[1] });

      await get(other, `/field-journals/${mine.id}`).expect(404);
      await get(other, `/field-journals/${mine.id}/reviews`).expect(404);
      const asOther = (
        await get(other, `/field-journals?teacherId=${teacherUser.id}&pageSize=100`).expect(200)
      ).body as Page;
      expect(asOther.items.every((j) => j.teacher.id === otherUser.id)).toBe(true);
      expect(asOther.items.map((j) => j.id)).toContain(theirs.id);

      for (const cookies of [coord, admin]) {
        await get(cookies, `/field-journals/${mine.id}`).expect(200);
        const page = (
          await get(cookies, `/field-journals?teacherId=${teacherUser.id}&pageSize=100`).expect(200)
        ).body as Page;
        expect(page.items.map((j) => j.id)).toContain(mine.id);
        expect(page.items.every((j) => j.teacher.id === teacherUser.id)).toBe(true);
      }
    });

    it('coordinación ve también borradores y anuladas; el listado trae entryCount sin entradas', async () => {
      const draft = await freshJournal();
      await addEntry(app, teacher, draft.id);
      await addEntry(app, teacher, draft.id);
      const voided = await freshJournal();
      await post(teacher, `/field-journals/${voided.id}/void`)
        .send({ reason: 'Por error' })
        .expect(200);

      const page = (
        await get(coord, `/field-journals?teacherId=${teacherUser.id}&pageSize=100`).expect(200)
      ).body as Page;
      const byId = new Map(page.items.map((j) => [j.id, j]));

      expect(byId.get(draft.id)).toMatchObject({ status: 'borrador', entryCount: 2 });
      expect(byId.get(draft.id)).not.toHaveProperty('entries');
      expect(byId.get(voided.id)?.status).toBe('anulado');
    });

    it('filtra por estado, grado y periodo y pagina', async () => {
      const first = await freshJournal(1);
      const second = await freshJournal(2);
      await addEntry(app, teacher, second.id);
      await post(teacher, `/field-journals/${second.id}/submit`).expect(200);
      const base = `/field-journals?teacherId=${teacherUser.id}`;

      const submitted = (await get(coord, `${base}&status=enviada&pageSize=100`).expect(200))
        .body as Page;
      expect(submitted.items.every((j) => j.status === 'enviada')).toBe(true);
      expect(submitted.items.map((j) => j.id)).toContain(second.id);

      const byGrade = (await get(coord, `${base}&gradeId=${first.grade.id}`).expect(200))
        .body as Page;
      expect(byGrade.items.map((j) => j.id)).toEqual([first.id]);

      const byPeriod = (
        await get(coord, `${base}&periodId=${planning.periods[2]}&pageSize=100`).expect(200)
      ).body as Page;
      expect(byPeriod.items.every((j) => j.period.id === planning.periods[2])).toBe(true);
      expect(byPeriod.items.map((j) => j.id)).toContain(second.id);

      const paged = (await get(coord, `${base}&pageSize=1&page=2`).expect(200)).body as Page;
      expect(paged).toMatchObject({ page: 2, items: expect.any(Array) as unknown[] });
      expect(paged.items).toHaveLength(1);
      expect(paged.totalItems).toBeGreaterThanOrEqual(2);
    });

    it('rechaza orden por un campo no permitido y estado inválido', async () => {
      await get(coord, '/field-journals?sortBy=students').expect(400);
      await get(coord, '/field-journals?status=otro').expect(400);
    });
  });
});
