import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { call, createNote, freshGrade, NOTE_CONTENT, type NoteBody } from './support/formats';
import { auditRows, setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { createTestUser, signIn, type Cookies, type TestUser } from './support/session';

// Textos sembrados únicos de esta ejecución: ninguno debe aparecer donde no corresponde.
const run = randomUUID().slice(0, 8);
const marker = (label: string) => `${label}-${run}`;
const STUDENT_A = 'Zaphod';
const STUDENT_B = 'Marvin';

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
    it('el observador: nombre, descripción, versión, estrategias, acciones y seguimiento quedan como [oculto]', async () => {
      const { gradeId } = await freshGrade(planning, []);
      const secrets = [
        'desc',
        'version',
        'acciones',
        'seguimiento',
        'editada',
        'ajuste',
        'estrategias',
      ].map(marker);
      const created = await createNote(app, teacher, {
        gradeId,
        studentFirstName: STUDENT_A,
        description: secrets[0],
        studentVersion: secrets[1],
        actions: secrets[2],
        followUp: secrets[3],
        pedagogicalStrategies: secrets[6],
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
        pedagogicalStrategies: '[oculto]',
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
