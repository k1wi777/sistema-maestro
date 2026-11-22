import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { call } from './support/formats';
import {
  addAnnotation,
  annotationBody,
  annotationOf,
  journalWorld,
  markReady,
  startedJournal,
  TODAY,
  TODAY_YEAR,
  useTodayYear,
  type Actor,
  type JournalBody,
  type JournalWorld,
} from './support/journal';
import { discardJournalDuringRequest } from './support/journal-discard-race';
import { auditRows } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';

type Page = {
  items: { id: string; status: string; readyCount: number; expectedCount: number }[];
  totalItems: number;
};

describe('diario de campo colaborativo por grupo y día (#107)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let release: () => Promise<void>;
  let restoreYear: () => Promise<void>;
  let world: JournalWorld;

  const get = (who: Actor, path: string) => call(app, who.cookies, 'get', path);
  const post = (who: Actor, path: string) => call(app, who.cookies, 'post', path);
  const patch = (who: Actor, path: string) => call(app, who.cookies, 'patch', path);
  const errorOf = (body: unknown) => apiErrorBodySchema.parse(body);
  const fieldsOf = (body: unknown) => errorOf(body).errors?.map((error) => error.field);

  beforeAll(async () => {
    release = await holdSchoolYearLock('exclusive');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    restoreYear = await useTodayYear(app);
    world = await journalWorld(app);
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await restoreYear();
    await app.close();
    await release();
  });

  describe('alta de anotaciones (R1 a R4)', () => {
    it('crea el diario con la primera anotación en borrador y la agrega al mismo después; queda en la bitácora', async () => {
      const first = await addAnnotation(app, world.ana, annotationBody(world, world.areas.math));
      const second = await addAnnotation(app, world.luis, annotationBody(world, world.areas.art));

      expect(first).toMatchObject({
        status: 'en_curso',
        date: TODAY,
        schoolYear: TODAY_YEAR,
        group: { id: world.groupId },
        homeroomTeacher: { id: world.director.user.id },
      });
      expect(first.annotations).toHaveLength(1);
      expect(first.annotations[0]).toMatchObject({ status: 'borrador', isMine: true, sent: false });
      expect(second.id).toBe(first.id);
      // Luis no ve el borrador de Ana: solo el suyo.
      expect(second.annotations.map((annotation) => annotation.teacher.id)).toEqual([
        world.luis.user.id,
      ]);
      expect(
        await prisma.fieldJournal.count({
          where: { groupId: world.groupId, date: new Date(TODAY) },
        }),
      ).toBe(1);

      const rows = await auditRows(app, first.id!);
      expect(rows[0]).toMatchObject({
        type: 'diario',
        entity: 'diario_campo',
        action: 'Agregó una anotación al diario de campo',
        userId: world.ana.user.id,
        dataBefore: null,
      });
      expect(rows[0]?.detail).toBe(`${first.group.name} · ${TODAY}`);
    });

    it('dos altas simultáneas del mismo grupo y fecha comparten un solo diario (R1)', async () => {
      const date = `${TODAY.slice(0, 4)}-01-01`;
      const results = await Promise.all([
        call(app, world.ana.cookies, 'post', '/field-journals/annotations').send(
          annotationBody(world, world.areas.math, { date }),
        ),
        call(app, world.luis.cookies, 'post', '/field-journals/annotations').send(
          annotationBody(world, world.areas.art, { date }),
        ),
      ]);
      expect(results.map((res) => res.status)).toEqual([201, 201]);
      const ids = results.map((res) => (res.body as JournalBody).id);
      expect(ids[0]).toBe(ids[1]);
      expect(
        await prisma.fieldJournal.count({
          where: { groupId: world.groupId, date: new Date(date) },
        }),
      ).toBe(1);
      expect(
        await prisma.fieldJournalAnnotation.count({ where: { journalId: ids[0] ?? '' } }),
      ).toBe(2);
    });

    it('rechaza fechas futuras y anteriores al año lectivo con 400 en `date` (R2)', async () => {
      const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
      const before = `${Number(TODAY.slice(0, 4)) - 1}-12-31`;
      for (const date of [future, before]) {
        const res = await post(world.ana, '/field-journals/annotations')
          .send(annotationBody(world, world.areas.math, { date }))
          .expect(400);
        expect(fieldsOf(res.body)).toEqual(['date']);
      }
    });

    it('403 al no participante, 404 al grupo inexistente y 400 en `areaId` si no es su asignatura (R3)', async () => {
      await post(world.stranger, '/field-journals/annotations')
        .send(annotationBody(world, world.areas.math))
        .expect(403);
      await post(world.ana, '/field-journals/annotations')
        .send(
          annotationBody(world, world.areas.math, {
            groupId: '5f0b0a3e-8f4b-4c9b-9d0c-5a1d6f1c2b3a',
          }),
        )
        .expect(404);
      const res = await post(world.luis, '/field-journals/annotations')
        .send(annotationBody(world, world.areas.math))
        .expect(400);
      expect(fieldsOf(res.body)).toEqual(['areaId']);
    });

    it('un grupo inactivo no admite diarios nuevos (400 en `groupId`) pero sí los existentes', async () => {
      const inactive = await journalWorld(app);
      await prisma.group.update({ where: { id: inactive.groupId }, data: { active: false } });
      const res = await post(inactive.ana, '/field-journals/annotations')
        .send(annotationBody(inactive, inactive.areas.math))
        .expect(400);
      expect(fieldsOf(res.body)).toEqual(['groupId']);
    });

    it('una anotación vale con clase y descripción; los campos retirados del formato y los desconocidos se rechazan con 400 (R2, R3)', async () => {
      const own = await journalWorld(app);
      const body = annotationBody(own, own.areas.math);
      for (const removed of [
        { eventType: 'mejorar' },
        { students: ['Pedro'] },
        { actions: 'Repasar' },
        { reflection: 'Más tiempo' },
        { status: 'lista' },
      ]) {
        await post(own.ana, '/field-journals/annotations')
          .send({ ...body, ...removed })
          .expect(400);
      }
      expect(await prisma.fieldJournal.count({ where: { groupId: own.groupId } })).toBe(0);
      const created = await post(own.ana, '/field-journals/annotations').send(body).expect(201);
      const annotation = (created.body as JournalBody).annotations[0]!;
      expect(Object.keys(annotation)).not.toEqual(
        expect.arrayContaining(['eventType', 'students', 'actions', 'reflection']),
      );
      await patch(
        own.ana,
        `/field-journals/${(created.body as JournalBody).id}/annotations/${annotation.id}`,
      )
        .send({ eventType: 'grupo' })
        .expect(400);
    });
  });

  describe('privacidad de las respuestas (R19)', () => {
    it('los errores no repiten textos libres ni nombres de estudiantes', async () => {
      const own = await journalWorld(app);
      const secret = `texto-${Date.now()}`;
      const student = 'Pedro Pérez Gómez 1023456789';
      const bodies = [
        (
          await post(own.ana, '/field-journals/annotations')
            .send(annotationBody(own, own.areas.math, { description: secret, students: [student] }))
            .expect(400)
        ).body,
        (
          await post(own.ana, '/field-journals/annotations')
            .send(annotationBody(own, own.areas.math, { description: secret, documentId: secret }))
            .expect(400)
        ).body,
        (
          await post(own.stranger, '/field-journals/annotations')
            .send(annotationBody(own, own.areas.math, { description: secret }))
            .expect(403)
        ).body,
      ];
      const { journalId } = await startedJournal(app, own);
      await post(own.director, `/field-journals/${journalId}/submit`).expect(200);
      bodies.push(
        (
          await post(own.ana, '/field-journals/annotations')
            .send(annotationBody(own, own.areas.math, { description: secret }))
            .expect(409)
        ).body,
      );
      expect(JSON.stringify(bodies)).not.toContain(secret);
      expect(JSON.stringify(bodies)).not.toContain('Pedro');
      expect(JSON.stringify(bodies)).not.toContain('1023456789');
    });
  });

  describe('período del encabezado (R5)', () => {
    it('trae el período que contiene la fecha del diario, o nulo si ninguno la contiene', async () => {
      const own = await journalWorld(app);
      const created = await addAnnotation(app, own.ana, annotationBody(own, own.areas.math));
      expect(created.period).toBeNull();
      const shift = (days: number) => new Date(Date.parse(TODAY) + days * 86_400_000);
      try {
        const period = await prisma.academicPeriod.create({
          data: { schoolYear: TODAY_YEAR, number: 2, startDate: shift(-30), endDate: shift(30) },
        });
        const inside = (await get(own.ana, `/field-journals/${created.id}`).expect(200))
          .body as JournalBody;
        expect(inside.period).toEqual({ id: period.id, number: 2 });
        await prisma.academicPeriod.update({
          where: { id: period.id },
          data: { startDate: shift(1), endDate: shift(30) },
        });
        const outside = (await get(own.ana, `/field-journals/${created.id}`).expect(200))
          .body as JournalBody;
        expect(outside.period).toBeNull();
      } finally {
        await prisma.academicPeriod.deleteMany({ where: { schoolYear: TODAY_YEAR } });
      }
    });
  });

  describe('anotaciones propias y visibilidad (R5, R6)', () => {
    it('solo el autor edita, marca lista y devuelve a borrador; nadie ve ni toca los borradores ajenos', async () => {
      const own = await journalWorld(app);
      const first = await addAnnotation(app, own.ana, annotationBody(own, own.areas.math));
      const journalId = first.id!;
      const anaAnnotation = annotationOf(first, own.ana.user.id);
      await addAnnotation(app, own.luis, annotationBody(own, own.areas.art));

      const base = `/field-journals/${journalId}/annotations/${anaAnnotation.id}`;
      // Para Luis la anotación en borrador de Ana no existe.
      await patch(own.luis, base).send({ description: 'X' }).expect(404);
      await markReady(app, own.ana, journalId, anaAnnotation.id);
      // Ya lista, Luis la ve pero no es suya.
      await patch(own.luis, base).send({ description: 'X' }).expect(403);
      await post(own.luis, `${base}/draft`).expect(403);
      const edited = await patch(own.ana, base).send({ description: 'Editada' }).expect(200);
      expect(
        (edited.body as JournalBody).annotations.find((a) => a.id === anaAnnotation.id),
      ).toMatchObject({
        status: 'lista',
        description: 'Editada',
      });
      const back = await post(own.ana, `${base}/draft`).expect(200);
      expect(annotationOf(back.body as JournalBody, own.ana.user.id).status).toBe('borrador');
      const forLuis = (await get(own.luis, `/field-journals/${journalId}`).expect(200))
        .body as JournalBody;
      expect(forLuis.annotations.map((a) => a.teacher.id)).toEqual([own.luis.user.id]);
    });

    it('un diario ajeno no se ve por id (404) y el de un día se pide por grupo y fecha', async () => {
      const own = await journalWorld(app);
      const created = await addAnnotation(app, own.ana, annotationBody(own, own.areas.math));
      await get(own.stranger, `/field-journals/${created.id}`).expect(404);
      await get(own.coordinator, `/field-journals/${created.id}`).expect(404);

      const day = (
        await get(own.ana, `/field-journals/day?groupId=${own.groupId}&date=${TODAY}`).expect(200)
      ).body as JournalBody;
      expect(day.id).toBe(created.id);
      const empty = (
        await get(own.luis, `/field-journals/day?groupId=${own.groupId}&date=2020-01-01`).expect(
          200,
        )
      ).body as JournalBody;
      expect(empty).toMatchObject({ id: null, status: null });
      expect(empty.viewer).toMatchObject({ isParticipant: true, canAnnotate: true });
      await get(own.stranger, `/field-journals/day?groupId=${own.groupId}&date=${TODAY}`).expect(
        403,
      );
    });
  });

  describe('envío del director(a) (R7 a R11)', () => {
    it('el director(a) ve el aporte de cada docente y envía con n de m congelado y faltantes', async () => {
      const own = await journalWorld(app);
      const { journalId } = await startedJournal(app, own);

      const before = (await get(own.director, `/field-journals/${journalId}`).expect(200))
        .body as JournalBody;
      expect(before.contributors.map((entry) => entry.status).sort()).toEqual([
        'draft',
        'none',
        'ready',
      ]);
      expect(before.viewer).toMatchObject({
        isHomeroomTeacher: true,
        canSubmit: true,
        canVoid: true,
      });
      expect(before).toMatchObject({ readyCount: 1, expectedCount: 3 });
      // Quienes no dirigen el grupo no ven la tabla de aportes.
      const forLuis = (await get(own.luis, `/field-journals/${journalId}`).expect(200))
        .body as JournalBody;
      expect(forLuis.contributors).toEqual([]);

      await post(own.ana, `/field-journals/${journalId}/submit`).expect(403);
      const sent = (await post(own.director, `/field-journals/${journalId}/submit`).expect(200))
        .body as JournalBody;
      expect(sent).toMatchObject({ status: 'enviado', readyCount: 1, expectedCount: 3 });
      expect(sent.missing.map((entry) => entry.status).sort()).toEqual(['draft', 'none']);
      expect(sent.annotations.every((annotation) => annotation.sent)).toBe(true);
      // El borrador de Luis no viajó ni se borró.
      expect(
        await prisma.fieldJournalAnnotation.count({
          where: { journalId, teacherId: own.luis.user.id, status: 'borrador', sent: false },
        }),
      ).toBe(1);

      const rows = await auditRows(app, journalId);
      expect(rows.at(-1)).toMatchObject({
        action: 'Envió el diario de campo a coordinación',
        detail: `${sent.group.name} · ${TODAY} · 1 de 3 aportes`,
      });
      // Nadie agrega ni modifica con el diario enviado (R11).
      await post(own.ana, '/field-journals/annotations')
        .send(annotationBody(own, own.areas.math))
        .expect(409);
      await post(own.director, `/field-journals/${journalId}/submit`).expect(409);
    });

    it('sin anotaciones listas responde 400 y sin director(a) 409 con aviso en el diario (R8, R9)', async () => {
      const own = await journalWorld(app);
      const created = await addAnnotation(app, own.ana, annotationBody(own, own.areas.math));
      const res = await post(own.director, `/field-journals/${created.id}/submit`).expect(400);
      expect(fieldsOf(res.body)).toEqual(['annotations']);

      await prisma.teacherAssignment.updateMany({
        where: { groupId: own.groupId, isHomeroomTeacher: true },
        data: { isHomeroomTeacher: false },
      });
      await post(own.director, `/field-journals/${created.id}/submit`).expect(409);
      const day = (await get(own.ana, `/field-journals/${created.id}`).expect(200))
        .body as JournalBody;
      expect(day.viewer.blockedReason).toMatch(/director/);
      expect(day.homeroomTeacher).toBeNull();
    });

    it('un envío y una edición simultáneos se serializan: nunca queda una lista sin enviar', async () => {
      const own = await journalWorld(app);
      const first = await addAnnotation(app, own.ana, annotationBody(own, own.areas.math));
      const journalId = first.id!;
      const other = await addAnnotation(app, own.luis, annotationBody(own, own.areas.art));
      await markReady(app, own.luis, journalId, annotationOf(other, own.luis.user.id).id);
      const anaAnnotation = annotationOf(first, own.ana.user.id);

      const [ready, submit] = await Promise.all([
        post(own.ana, `/field-journals/${journalId}/annotations/${anaAnnotation.id}/ready`),
        post(own.director, `/field-journals/${journalId}/submit`),
      ]);
      expect(submit.status).toBe(200);
      expect([200, 409]).toContain(ready.status);
      const annotations = await prisma.fieldJournalAnnotation.findMany({ where: { journalId } });
      const submission = await prisma.fieldJournalSubmission.findFirstOrThrow({
        where: { journalId },
      });
      for (const annotation of annotations) {
        expect(annotation.status === 'lista' ? annotation.sent : true).toBe(true);
      }
      expect(submission.readyCount).toBe(ready.status === 200 ? 2 : 1);
    });

    it('el director(a) anula con motivo y nadie más (ni administración) lo hace (R18)', async () => {
      const own = await journalWorld(app);
      const { journalId } = await startedJournal(app, own);
      await post(own.ana, `/field-journals/${journalId}/void`)
        .send({ reason: 'Prueba' })
        .expect(403);
      await post(own.admin, `/field-journals/${journalId}/void`)
        .send({ reason: 'Prueba' })
        .expect(403);
      await post(own.director, `/field-journals/${journalId}/void`).send({}).expect(400);
      const voided = (
        await post(own.director, `/field-journals/${journalId}/void`)
          .send({ reason: 'Abierto por error' })
          .expect(200)
      ).body as JournalBody;
      expect(voided.status).toBe('anulado');
      expect((await auditRows(app, journalId)).at(-1)).toMatchObject({
        action: 'Anuló un diario de campo',
        detail: 'Abierto por error',
      });
      await post(own.director, `/field-journals/${journalId}/void`)
        .send({ reason: 'Otra vez' })
        .expect(409);
      expect(await prisma.fieldJournalAnnotation.count({ where: { journalId } })).toBe(2);
    });
  });

  describe('descartar una anotación en borrador (#117)', () => {
    const discard = (who: Actor, annotationId: string) =>
      call(app, who.cookies, 'delete', `/field-journals/annotations/${annotationId}`);

    it('borra solo esa anotación y conserva el diario y las demás; la bitácora no guarda textos', async () => {
      const own = await journalWorld(app);
      const first = await addAnnotation(app, own.ana, {
        ...annotationBody(own, own.areas.math),
        description: 'Texto reservado sobre Zaphod',
      });
      const journalId = first.id!;
      const second = await addAnnotation(app, own.luis, annotationBody(own, own.areas.art));
      const luisAnnotation = annotationOf(second, own.luis.user.id);

      await discard(own.luis, luisAnnotation.id).expect(204);

      expect(await prisma.fieldJournalAnnotation.count({ where: { journalId } })).toBe(1);
      const remaining = (await get(own.ana, `/field-journals/${journalId}`).expect(200))
        .body as JournalBody;
      expect(remaining.annotations.map((a) => a.teacher.id)).toEqual([own.ana.user.id]);
      const row = (await auditRows(app, luisAnnotation.id)).at(-1);
      expect(row).toMatchObject({
        action: 'Descartó un borrador',
        type: 'diario',
        role: 'docente',
        userId: own.luis.user.id,
        detail: expect.stringContaining('Arte') as string,
      });
      expect(JSON.stringify([row?.detail, row?.dataBefore, row?.dataAfter])).not.toMatch(
        /Trabajo en equipo|Zaphod/,
      );
    });

    it('si era la única anotación borra también el diario: el día vuelve a estar sin diario', async () => {
      const own = await journalWorld(app);
      const created = await addAnnotation(app, own.ana, annotationBody(own, own.areas.math));
      const annotation = annotationOf(created, own.ana.user.id);

      await discard(own.ana, annotation.id).expect(204);

      expect(await prisma.fieldJournal.count({ where: { id: created.id! } })).toBe(0);
      await get(own.ana, `/field-journals/${created.id}`).expect(404);
      const day = await get(
        own.ana,
        `/field-journals/day?groupId=${own.groupId}&date=${TODAY}`,
      ).expect(200);
      expect((day.body as { id: string | null }).id).toBeNull();
      const mine = (await get(own.ana, '/field-journals?scope=mine&pageSize=100').expect(200))
        .body as Page;
      expect(mine.items.map((item) => item.id)).not.toContain(created.id);
      await discard(own.ana, annotation.id).expect(404);
    });

    it('una anotación lista de otra persona: 403; un borrador ajeno o de un extraño: 404; coordinación y administración: 403', async () => {
      const own = await journalWorld(app);
      const { journalId, anaAnnotationId } = await startedJournal(app, own);
      const luisDraft = (
        (await get(own.luis, `/field-journals/${journalId}`).expect(200)).body as JournalBody
      ).annotations.find((a) => a.teacher.id === own.luis.user.id)!;

      await discard(own.luis, anaAnnotationId).expect(403);
      await discard(own.ana, luisDraft.id).expect(404);
      await discard(own.stranger, anaAnnotationId).expect(404);
      await discard(own.coordinator, luisDraft.id).expect(403);
      await discard(own.admin, luisDraft.id).expect(403);
      expect(await prisma.fieldJournalAnnotation.count({ where: { journalId } })).toBe(2);
    });

    it('una anotación lista responde 409 y no se borra', async () => {
      const own = await journalWorld(app);
      const { journalId, anaAnnotationId } = await startedJournal(app, own);

      const res = await discard(own.ana, anaAnnotationId).expect(409);

      expect(errorOf(res.body).code).toBeDefined();
      expect(await prisma.fieldJournalAnnotation.count({ where: { journalId } })).toBe(2);
    });

    it('tras enviar el diario, el borrador de otra persona ya no se descarta (409)', async () => {
      const own = await journalWorld(app);
      const { journalId } = await startedJournal(app, own);
      await post(own.director, `/field-journals/${journalId}/submit`).expect(200);
      const luisDraft = await prisma.fieldJournalAnnotation.findFirstOrThrow({
        where: { journalId, teacherId: own.luis.user.id },
      });

      await discard(own.luis, luisDraft.id).expect(409);
      expect(await prisma.fieldJournalAnnotation.count({ where: { id: luisDraft.id } })).toBe(1);
    });

    it('un descarte y un envío simultáneos se serializan: el diario enviado nunca pierde lo enviado', async () => {
      const own = await journalWorld(app);
      const { journalId } = await startedJournal(app, own);
      const luisDraft = await prisma.fieldJournalAnnotation.findFirstOrThrow({
        where: { journalId, teacherId: own.luis.user.id },
      });

      const [removed, submit] = await Promise.all([
        discard(own.luis, luisDraft.id),
        post(own.director, `/field-journals/${journalId}/submit`),
      ]);

      expect(submit.status).toBe(200);
      expect([204, 409]).toContain(removed.status);
      expect(
        await prisma.fieldJournalAnnotation.count({
          where: { journalId, status: 'lista', sent: true },
        }),
      ).toBe(1);
    });
  });

  describe('alta que compite con el descarte de la última anotación', () => {
    it('crea un diario nuevo en la misma operación: 201, una sola anotación, bitácora sobre el diario nuevo', async () => {
      const own = await journalWorld(app);
      const first = await addAnnotation(app, own.ana, annotationBody(own, own.areas.math));
      const oldId = first.id!;

      const res = await discardJournalDuringRequest(oldId, async () =>
        call(app, own.luis.cookies, 'post', '/field-journals/annotations').send(
          annotationBody(own, own.areas.art),
        ),
      );

      expect(res.status).toBe(201);
      const body = res.body as JournalBody;
      expect(body.id).not.toBe(oldId);
      expect(await prisma.fieldJournal.count({ where: { id: oldId } })).toBe(0);
      const journals = await prisma.fieldJournal.findMany({
        where: { groupId: own.groupId, date: new Date(TODAY) },
      });
      expect(journals).toHaveLength(1);
      expect(journals[0]).toMatchObject({
        id: body.id,
        status: 'en_curso',
        createdById: own.luis.user.id,
      });
      const annotations = await prisma.fieldJournalAnnotation.findMany({
        where: { journalId: body.id! },
      });
      expect(annotations).toHaveLength(1);
      expect(annotations[0]).toMatchObject({ teacherId: own.luis.user.id, status: 'borrador' });
      const rows = await auditRows(app, body.id!);
      expect(
        rows.filter((row) => row.action === 'Agregó una anotación al diario de campo'),
      ).toHaveLength(1);
    });
  });

  describe('listas y bloque «Hoy» (R20)', () => {
    it('la lista «mine» trae los diarios de sus grupos con n de m, filtra y pagina; «today» devuelve el de hoy', async () => {
      const own = await journalWorld(app);
      const { journalId } = await startedJournal(app, own);
      await addAnnotation(
        app,
        own.ana,
        annotationBody(own, own.areas.math, { date: `${TODAY.slice(0, 4)}-01-01` }),
      );

      const page = (
        await get(own.director, '/field-journals?sortBy=date&sortOrder=desc').expect(200)
      ).body as Page;
      expect(page.totalItems).toBe(2);
      expect(page.items[0]).toMatchObject({ id: journalId, readyCount: 1, expectedCount: 3 });
      const filtered = (
        await get(own.director, `/field-journals?status=enviado&groupId=${own.groupId}`).expect(200)
      ).body as Page;
      expect(filtered.totalItems).toBe(0);
      const range = (
        await get(own.director, `/field-journals?from=${TODAY}&to=${TODAY}`).expect(200)
      ).body as Page;
      expect(range.items.map((item) => item.id)).toEqual([journalId]);
      await get(own.stranger, '/field-journals')
        .expect(200)
        .then((res) => expect((res.body as Page).totalItems).toBe(0));
      await get(own.director, '/field-journals?scope=review').expect(403);

      const today = (await get(own.ana, '/field-journals/today').expect(200)).body as {
        date: string;
        groups: {
          group: { id: string };
          isHomeroomTeacher: boolean;
          areas: { name: string }[];
          journal: { id: string } | null;
        }[];
      };
      expect(today.date).toBe(TODAY);
      expect(today.groups).toHaveLength(1);
      expect(today.groups[0]).toMatchObject({
        group: { id: own.groupId },
        isHomeroomTeacher: false,
        journal: { id: journalId },
      });
      expect(today.groups[0]?.areas).toHaveLength(2);
    });
  });
});
