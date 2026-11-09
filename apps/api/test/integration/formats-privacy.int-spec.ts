import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import {
  addEntry,
  call,
  createJournal,
  createNote,
  ENTRY_CONTENT,
  freshGrade,
  NOTE_CONTENT,
  type NoteBody,
} from './support/formats';
import { auditRows, setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { createTestUser, signIn, type Cookies, type TestUser } from './support/session';

// Textos sembrados únicos de esta ejecución: ninguno debe aparecer donde no corresponde.
const run = randomUUID().slice(0, 8);
const marker = (label: string) => `${label}-${run}`;
const STUDENT_A = 'Zaphod';
const STUDENT_B = 'Marvin';
const STUDENT_C = 'Trillian';

describe('privacidad del diario y el observador (BE-6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let teacherUser: TestUser;
  let teacher: Cookies;
  let other: Cookies;
  let coord: Cookies;
  let logLines: string[];

  const post = (cookies: Cookies, path: string) => call(app, cookies, 'post', path);
  const patch = (cookies: Cookies, path: string) => call(app, cookies, 'patch', path);
  const get = (cookies: Cookies, path: string) => call(app, cookies, 'get', path);

  /** Serializa lo que la bitácora guardó de las filas (antes, después y detalle). */
  const auditText = async (id: string, withDetail = false) =>
    JSON.stringify(
      (await auditRows(app, id)).map((row) => [
        row.dataBefore,
        row.dataAfter,
        withDetail ? row.detail : null,
      ]),
    );

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    logLines = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        logLines.push(chunk.toString());
        done();
      },
    });
    app = await createTestApp({
      withFailures: false,
      accessLogStream: stream,
      config: { LOG_LEVEL: 'info' },
    });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    teacherUser = await createTestUser(app);
    teacher = await signIn(app, teacherUser);
    other = await signIn(app, await createTestUser(app));
    coord = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  describe('campos no definidos (R17)', () => {
    const PERSONAL = ['documentId', 'phone', 'address', 'diagnosis', 'photo', 'lastName'];

    it('el cuerpo del diario con un campo desconocido responde 400 y no guarda nada', async () => {
      const { gradeId } = await freshGrade(planning, [teacherUser.id]);
      const journal = await createJournal(app, teacher, { gradeId, periodId: planning.periods[1] });
      const other2 = (await freshGrade(planning, [teacherUser.id])).gradeId;

      for (const field of PERSONAL) {
        const secret = marker(field);
        const create = await post(teacher, '/field-journals')
          .send({ gradeId: other2, periodId: planning.periods[1], [field]: secret })
          .expect(400);
        const entry = await post(teacher, `/field-journals/${journal.id}/entries`)
          .send({ ...ENTRY_CONTENT, [field]: secret })
          .expect(400);
        expect(JSON.stringify([create.body, entry.body])).not.toContain(secret);
      }
      await patch(teacher, `/field-journals/${journal.id}/entries/${randomUUID()}`)
        .send({ photo: 'x' })
        .expect(400);
      expect(
        await prisma.fieldJournal.count({ where: { teacherId: teacherUser.id, gradeId: other2 } }),
      ).toBe(0);
      expect(await prisma.fieldJournalEntry.count({ where: { journalId: journal.id } })).toBe(0);
    });

    it('el cuerpo del observador con un campo desconocido responde 400 y no guarda nada', async () => {
      const { gradeId } = await freshGrade(planning, []);
      for (const field of PERSONAL) {
        const secret = marker(field);
        const res = await post(teacher, '/observer-notes')
          .send({ ...NOTE_CONTENT, gradeId, [field]: secret })
          .expect(400);
        expect(JSON.stringify(res.body)).not.toContain(secret);
      }
      expect(
        await prisma.observerNote.count({ where: { teacherId: teacherUser.id, gradeId } }),
      ).toBe(0);

      const created = await createNote(app, teacher, { gradeId });
      await patch(teacher, `/observer-notes/${created.id}`).send({ guardianName: 'x' }).expect(400);
    });

    it('los ajustes de coordinación y las queries también rechazan campos desconocidos', async () => {
      const { gradeId } = await freshGrade(planning, []);
      const created = await createNote(app, teacher, { gradeId });
      await post(teacher, `/observer-notes/${created.id}/submit`).expect(200);

      await post(coord, `/observer-notes/${created.id}/approve`)
        .send({ changes: { diagnosis: 'x' } })
        .expect(400);
      await post(coord, `/observer-notes/${created.id}/approve`).send({ photo: 'x' }).expect(400);
      await get(coord, '/field-journals?studentName=Ana').expect(400);
      await get(coord, '/observer-notes?document=1').expect(400);
      await get(coord, '/observer-notes?studentFirstName=Ana').expect(400);
      expect(
        (await prisma.observerNote.findUniqueOrThrow({ where: { id: created.id } })).status,
      ).toBe('enviada');
    });
  });

  describe('bitácora sin datos de menores (R18, R22)', () => {
    it('el diario: nombres, descripciones, acciones y reflexión quedan como [oculto]', async () => {
      const { gradeId } = await freshGrade(planning, [teacherUser.id]);
      const journal = await createJournal(app, teacher, { gradeId, periodId: planning.periods[1] });
      const texts = [marker('desc'), marker('acciones'), marker('reflexion'), marker('nueva')];

      const added = await addEntry(app, teacher, journal.id, {
        students: [STUDENT_A, STUDENT_B],
        description: texts[0],
        actions: texts[1],
        reflection: texts[2],
        eventType: 'mejorar',
      });
      const entryId = added.entries[0]?.id ?? '';
      await patch(teacher, `/field-journals/${journal.id}/entries/${entryId}`)
        .send({ description: texts[3], students: [STUDENT_C] })
        .expect(200);
      await post(teacher, `/field-journals/${journal.id}/submit`).expect(200);
      await post(coord, `/field-journals/${journal.id}/return`)
        .send({
          comment: 'Ajuste',
          changes: { entries: [{ id: entryId, description: marker('ajuste'), lesson: 'Arte' }] },
        })
        .expect(200);
      await post(teacher, `/field-journals/${journal.id}/void`)
        .send({ reason: 'Hoja de prueba' })
        .expect(200);

      const text = await auditText(journal.id);
      for (const secret of [...texts, STUDENT_A, STUDENT_B, STUDENT_C, marker('ajuste')]) {
        expect(text).not.toContain(secret);
      }
      expect(text).toContain('[oculto]');
      const rows = await auditRows(app, journal.id);
      expect(rows.map((row) => row.action)).toEqual([
        'Creó una hoja de diario de campo',
        'Agregó un registro al diario de campo',
        'Editó un registro del diario de campo',
        'Envió el diario de campo',
        'Dejó observaciones en un diario de campo',
        'Anuló un diario de campo',
      ]);
      // Se ve qué cambió: la clase, el estado y que la descripción cambió (ambos lados ocultos).
      expect(JSON.stringify(rows[4]?.dataAfter)).toContain('Arte');
      expect(JSON.stringify(rows[2]?.dataBefore)).toContain('[oculto]');
      expect(JSON.stringify(rows[2]?.dataAfter)).toContain('[oculto]');
      // El contenido sí vive en el historial de revisión, visible solo a dueño y coordinación.
      const review = await prisma.review.findMany({ where: { recordId: journal.id } });
      expect(JSON.stringify(review)).toContain(marker('ajuste'));
    });

    it('el observador: nombre, descripción, versión, acciones y seguimiento quedan como [oculto]', async () => {
      const { gradeId } = await freshGrade(planning, []);
      const secrets = ['desc', 'version', 'acciones', 'seguimiento', 'editada', 'ajuste'].map(
        marker,
      );
      const created = await createNote(app, teacher, {
        gradeId,
        studentFirstName: STUDENT_A,
        description: secrets[0],
        studentVersion: secrets[1],
        actions: secrets[2],
        followUp: secrets[3],
      });
      await patch(teacher, `/observer-notes/${created.id}`)
        .send({ description: secrets[4], studentFirstName: STUDENT_B, type: 'tipo_ii' })
        .expect(200);
      await post(teacher, `/observer-notes/${created.id}/submit`).expect(200);
      await post(coord, `/observer-notes/${created.id}/approve`)
        .send({ changes: { description: secrets[5], type: 'tipo_iii' } })
        .expect(200);
      await post(coord, `/observer-notes/${created.id}/void`)
        .send({ reason: 'Prueba' })
        .expect(200);

      const text = await auditText(created.id);
      for (const secret of [...secrets, STUDENT_A, STUDENT_B]) {
        expect(text).not.toContain(secret);
      }
      const rows = await auditRows(app, created.id);
      expect(rows).toHaveLength(5);
      expect(rows[0]?.dataAfter).toMatchObject({
        studentFirstName: '[oculto]',
        description: '[oculto]',
        studentVersion: '[oculto]',
        actions: '[oculto]',
        followUp: '[oculto]',
        type: 'positiva',
      });
      // La edición muestra qué campos cambiaron sin su contenido.
      expect(rows[1]?.dataBefore).toMatchObject({ description: '[oculto]', type: 'positiva' });
      expect(rows[1]?.dataAfter).toMatchObject({ description: '[oculto]', type: 'tipo_ii' });
      expect(rows[3]?.dataAfter).toMatchObject({ type: 'tipo_iii', status: 'revisada' });
    });
  });

  describe('logs y errores sin textos de los registros (R19)', () => {
    it('ningún nombre ni texto aparece en el log ni en las respuestas 201, 400, 403, 404 y 409', async () => {
      const { gradeId } = await freshGrade(planning, [teacherUser.id]);
      const description = marker('descripcion-log');
      const secrets = [description, 'Gonzalo', 'Valderrama', STUDENT_A];
      const bodies: unknown[] = [];
      logLines.length = 0;

      const created = await post(teacher, '/observer-notes')
        .send({ ...NOTE_CONTENT, gradeId, studentFirstName: STUDENT_A, description })
        .expect(201);
      const id = (created.body as NoteBody).id;
      bodies.push(
        (
          await post(teacher, '/observer-notes')
            .send({
              ...NOTE_CONTENT,
              gradeId,
              studentFirstName: 'Gonzalo Pérez Valderrama',
              description,
            })
            .expect(400)
        ).body,
        (await patch(coord, `/observer-notes/${id}`).send({ description }).expect(403)).body,
        (await patch(other, `/observer-notes/${id}`).send({ description }).expect(404)).body,
      );
      await post(teacher, `/observer-notes/${id}/submit`).expect(200);
      bodies.push(
        (await patch(teacher, `/observer-notes/${id}`).send({ description }).expect(409)).body,
      );

      const journal = await createJournal(app, teacher, { gradeId, periodId: planning.periods[1] });
      await addEntry(app, teacher, journal.id, { students: [STUDENT_A], description });
      await post(teacher, `/field-journals/${journal.id}/submit`).expect(200);
      bodies.push(
        (
          await post(teacher, `/field-journals/${journal.id}/entries`)
            .send({ ...ENTRY_CONTENT, description, students: [STUDENT_A] })
            .expect(409)
        ).body,
        (
          await post(teacher, `/field-journals/${journal.id}/entries`)
            .send({
              ...ENTRY_CONTENT,
              description,
              students: ['Gonzalo Pérez Valderrama'],
              extra: 1,
            })
            .expect(400)
        ).body,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));

      const everything = JSON.stringify([bodies, logLines]);
      for (const secret of secrets) {
        expect(everything).not.toContain(secret);
      }
      expect(logLines.length).toBeGreaterThan(0);
      // El 201 devuelve la anotación a su dueño: es la única respuesta que lleva el contenido.
      expect((created.body as NoteBody).studentFirstName).toBe(STUDENT_A);
      expect((await get(teacher, `/observer-notes/${id}`).expect(200)).body).toMatchObject({
        description,
      });
    });
  });
});
