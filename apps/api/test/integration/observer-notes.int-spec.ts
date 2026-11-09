import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, RecordStatus, UserRole } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import {
  call,
  createNote,
  forceNoteStatus,
  freshGrade,
  NOTE_CONTENT,
  unknownId,
  type NoteBody,
} from './support/formats';
import { auditRows, setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { createTestUser, signIn, type Cookies, type TestUser } from './support/session';

type Page = { items: NoteBody[]; totalItems: number; page: number; totalPages: number };

// Año propio de este archivo (no vigente): sus periodos fijan fechas sin tocar los compartidos.
const DATED_YEAR = '2041-2042';

describe('observador del estudiante (BE-63)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let teacherUser: TestUser;
  let teacher: Cookies;
  let other: Cookies;
  let coord: Cookies;
  let admin: Cookies;
  let gradeId: string;

  const get = (cookies: Cookies, path: string) => call(app, cookies, 'get', path);
  const post = (cookies: Cookies, path: string) => call(app, cookies, 'post', path);
  const patch = (cookies: Cookies, path: string) => call(app, cookies, 'patch', path);
  const errorOf = (body: unknown) => apiErrorBodySchema.parse(body);
  const fieldsOf = (body: unknown) => errorOf(body).errors?.map((e) => e.field);
  const note = (extra: Record<string, unknown> = {}) =>
    createNote(app, teacher, { gradeId, ...extra });

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    teacherUser = await createTestUser(app);
    teacher = await signIn(app, teacherUser);
    other = await signIn(app, await createTestUser(app));
    coord = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
    admin = await signIn(app, await createTestUser(app, { role: UserRole.Administrator }));
    gradeId = (await freshGrade(planning, [])).gradeId;
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  describe('crear (R8, R15)', () => {
    it('crea en borrador con el docente de la sesión sobre un grado sin asignación y lo deja en la bitácora', async () => {
      const created = await note({
        studentVersion: 'Dice que fue sin querer',
        actions: 'Hablar con la familia',
        familyInformed: true,
        followUp: 'Revisar en una semana',
      });

      expect(created).toMatchObject({
        status: RecordStatus.Draft,
        teacher: { id: teacherUser.id },
        grade: { id: gradeId },
        studentFirstName: 'Sofía',
        type: 'positiva',
        familyInformed: true,
        followUp: 'Revisar en una semana',
      });
      const rows = await auditRows(app, created.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: 'observador',
        entity: 'observador_anotacion',
        action: 'Registró una anotación en el observador',
        userId: teacherUser.id,
      });
    });

    it('guarda familia informada en falso por defecto y normaliza el nombre', async () => {
      const created = await note({ studentFirstName: '  María   José ' });
      expect(created).toMatchObject({ familyInformed: false, studentFirstName: 'María José' });
    });

    it('un grado inexistente responde 400 con el campo gradeId', async () => {
      const res = await post(teacher, '/observer-notes')
        .send({ ...NOTE_CONTENT, gradeId: unknownId() })
        .expect(400);
      expect(fieldsOf(res.body)).toEqual(['gradeId']);
    });

    it('solo acepta nombre de pila: rechaza apellidos, documentos, correos y símbolos sin repetir el valor', async () => {
      for (const name of [
        'María del Carmen',
        'Sofía Pérez Gómez',
        '1023456789',
        'Ana3',
        'ana@colegio.co',
        'Cl. 10',
        'J',
        '',
      ]) {
        const res = await post(teacher, '/observer-notes')
          .send({ ...NOTE_CONTENT, gradeId, studentFirstName: name })
          .expect(400);
        expect(fieldsOf(res.body)).toEqual(['studentFirstName']);
        if (name) {
          expect(JSON.stringify(res.body)).not.toContain(name);
        }
      }
    });

    it('rechaza tipo, fecha o descripción inválidos y campos no definidos', async () => {
      const base = { ...NOTE_CONTENT, gradeId };
      await post(teacher, '/observer-notes')
        .send({ ...base, type: 'tipo_iv' })
        .expect(400);
      await post(teacher, '/observer-notes')
        .send({ ...base, date: '10/03/2031' })
        .expect(400);
      await post(teacher, '/observer-notes')
        .send({ ...base, description: '' })
        .expect(400);
      await post(teacher, '/observer-notes')
        .send({ ...base, description: 'x'.repeat(1501) })
        .expect(400);
      await post(teacher, '/observer-notes')
        .send({ ...base, status: 'revisada' })
        .expect(400);
      await post(teacher, '/observer-notes')
        .send({ ...base, teacherId: unknownId() })
        .expect(400);
    });
  });

  describe('editar y enviar (R9)', () => {
    it('el dueño edita todo salvo el grado y la anotación conserva lo demás', async () => {
      const created = await note();

      const res = await patch(teacher, `/observer-notes/${created.id}`)
        .send({ type: 'tipo_ii', studentFirstName: 'Luis', familyInformed: true, actions: 'Citar' })
        .expect(200);
      expect(res.body).toMatchObject({
        type: 'tipo_ii',
        studentFirstName: 'Luis',
        familyInformed: true,
        actions: 'Citar',
        description: NOTE_CONTENT.description,
      });
      await patch(teacher, `/observer-notes/${created.id}`).send({ gradeId }).expect(400);
      await patch(teacher, `/observer-notes/${created.id}`).send({}).expect(400);
      expect((await auditRows(app, created.id)).at(-1)).toMatchObject({
        action: 'Editó una anotación del observador',
      });
    });

    it('quien no es dueño recibe 404 si no la ve y 403 si la ve; enviada o revisada responde 409', async () => {
      const created = await note();
      const path = `/observer-notes/${created.id}`;

      await patch(other, path).send({ type: 'otra' }).expect(404);
      await post(other, `${path}/submit`).expect(404);
      for (const cookies of [coord, admin]) {
        await patch(cookies, path).send({ type: 'otra' }).expect(403);
        await post(cookies, `${path}/submit`).expect(403);
      }

      await post(teacher, `${path}/submit`).expect(200);
      await patch(teacher, path).send({ type: 'otra' }).expect(409);
      await post(teacher, `${path}/submit`).expect(409);
      await forceNoteStatus(app, created.id, RecordStatus.Reviewed);
      await patch(teacher, path).send({ type: 'otra' }).expect(409);
      expect(
        (await prisma.observerNote.findUniqueOrThrow({ where: { id: created.id } })).type,
      ).toBe('positiva');
    });

    it('en observaciones el dueño puede editar y volver a enviar', async () => {
      const created = await note();
      await forceNoteStatus(app, created.id, RecordStatus.ChangesRequested);

      await patch(teacher, `/observer-notes/${created.id}`)
        .send({ description: 'Corregida' })
        .expect(200);
      const sent = await post(teacher, `/observer-notes/${created.id}/submit`).expect(200);

      expect((sent.body as NoteBody).status).toBe(RecordStatus.Submitted);
      expect((await auditRows(app, created.id)).at(-1)).toMatchObject({
        action: 'Envió una anotación del observador',
      });
    });
  });

  describe('listado, orden y filtros (R10, R20, R21)', () => {
    let owner: TestUser;
    let ownerCookies: Cookies;
    let ownerGrade: string;
    const ids = new Map<string, string>();

    beforeAll(async () => {
      owner = await createTestUser(app);
      ownerCookies = await signIn(app, owner);
      ownerGrade = (await freshGrade(planning, [])).gradeId;
      const seed: [string, string, string][] = [
        ['positiva', '2031-03-05', 'Ana'],
        ['tipo_ii', '2031-03-01', 'Beto'],
        ['tipo_iii', '2031-03-03', 'Caro'],
        ['otra', '2031-03-09', 'Dani'],
        ['academica', '2031-03-07', 'Eli'],
        ['tipo_i', '2031-03-02', 'Fer'],
        ['tipo_ii', '2031-03-08', 'Gabi'],
      ];
      for (const [type, date, studentFirstName] of seed) {
        const created = await createNote(app, ownerCookies, {
          gradeId: ownerGrade,
          type,
          date,
          studentFirstName,
        });
        ids.set(studentFirstName, created.id);
      }
    });

    const names = (page: Page) => page.items.map((n) => n.studentFirstName);
    const listPath = (query: string) => `/observer-notes?teacherId=${owner.id}&${query}`;

    it('por defecto pone primero tipo III y II y, dentro de cada grupo, la fecha más reciente', async () => {
      const page = (await get(coord, listPath('pageSize=100')).expect(200)).body as Page;
      // II/III por fecha desc (Gabi 08, Caro 03, Beto 01); el resto por fecha desc.
      expect(names(page)).toEqual(['Gabi', 'Caro', 'Beto', 'Dani', 'Eli', 'Ana', 'Fer']);
      expect(page.totalItems).toBe(7);
    });

    it('el orden es estable entre páginas y no repite ni omite filas', async () => {
      const collected: string[] = [];
      for (const pageNumber of [1, 2, 3, 4]) {
        const page = (await get(coord, listPath(`pageSize=2&page=${pageNumber}`)).expect(200))
          .body as Page;
        expect(page.totalItems).toBe(7);
        expect(page.totalPages).toBe(4);
        collected.push(...names(page));
      }
      expect(collected).toEqual(['Gabi', 'Caro', 'Beto', 'Dani', 'Eli', 'Ana', 'Fer']);
    });

    it('sortOrder=asc invierte la fecha dentro de cada grupo; sortBy=date ignora la prioridad', async () => {
      const asc = (await get(coord, listPath('sortOrder=asc&pageSize=100')).expect(200))
        .body as Page;
      expect(names(asc)).toEqual(['Beto', 'Caro', 'Gabi', 'Fer', 'Ana', 'Eli', 'Dani']);

      const byDate = (await get(coord, listPath('sortBy=date&pageSize=100')).expect(200))
        .body as Page;
      expect(names(byDate)).toEqual(['Dani', 'Gabi', 'Eli', 'Ana', 'Caro', 'Fer', 'Beto']);
    });

    it('un docente ve primero sus casos graves y solo ve sus anotaciones', async () => {
      const mine = (await get(ownerCookies, '/observer-notes?pageSize=100').expect(200))
        .body as Page;
      expect(names(mine).slice(0, 3)).toEqual(['Gabi', 'Caro', 'Beto']);
      expect(mine.items.every((n) => n.teacher.id === owner.id)).toBe(true);

      const asOther = (
        await get(other, `/observer-notes?teacherId=${owner.id}&pageSize=100`).expect(200)
      ).body as Page;
      expect(asOther.items.every((n) => n.teacher.id !== owner.id)).toBe(true);
      await get(other, `/observer-notes/${ids.get('Gabi')}`).expect(404);
      await get(other, `/observer-notes/${ids.get('Gabi')}/reviews`).expect(404);
      await get(coord, `/observer-notes/${ids.get('Gabi')}`).expect(200);
    });

    it('filtra por tipo, grado, estado y docente', async () => {
      const byType = (await get(coord, listPath('type=tipo_ii&pageSize=100')).expect(200))
        .body as Page;
      expect(names(byType)).toEqual(['Gabi', 'Beto']);

      const byGrade = (
        await get(coord, `/observer-notes?gradeId=${ownerGrade}&pageSize=100`).expect(200)
      ).body as Page;
      expect(byGrade.totalItems).toBe(7);

      await post(ownerCookies, `/observer-notes/${ids.get('Ana')}/submit`).expect(200);
      const submitted = (await get(coord, listPath('status=enviada&pageSize=100')).expect(200))
        .body as Page;
      expect(names(submitted)).toEqual(['Ana']);
      await get(coord, '/observer-notes?type=tipo_iv').expect(400);
    });

    it('filtra por periodo con sus fechas y responde 400 con el campo periodId si no las tiene', async () => {
      await prisma.schoolYear.createMany({ data: [{ code: DATED_YEAR }], skipDuplicates: true });
      await prisma.academicPeriod.createMany({
        data: [
          { schoolYear: DATED_YEAR, number: 1 },
          { schoolYear: DATED_YEAR, number: 2 },
        ],
        skipDuplicates: true,
      });
      await prisma.academicPeriod.updateMany({
        where: { schoolYear: DATED_YEAR, number: 1 },
        data: { startDate: new Date('2031-03-02'), endDate: new Date('2031-03-07') },
      });
      await prisma.academicPeriod.updateMany({
        where: { schoolYear: DATED_YEAR, number: 2 },
        data: { startDate: null, endDate: null },
      });
      const periods = await prisma.academicPeriod.findMany({ where: { schoolYear: DATED_YEAR } });
      const dated = periods.find((p) => p.number === 1)?.id ?? '';
      const undated = periods.find((p) => p.number === 2)?.id ?? '';

      const inPeriod = (await get(coord, listPath(`periodId=${dated}&pageSize=100`)).expect(200))
        .body as Page;
      expect(names(inPeriod)).toEqual(['Caro', 'Eli', 'Ana', 'Fer']);

      for (const periodId of [undated, unknownId()]) {
        const res = await get(coord, listPath(`periodId=${periodId}`)).expect(400);
        expect(fieldsOf(res.body)).toEqual(['periodId']);
      }
    });

    it('rechaza orden por un campo no permitido y parámetros desconocidos', async () => {
      await get(coord, '/observer-notes?sortBy=studentFirstName').expect(400);
      await get(coord, '/observer-notes?studentFirstName=Ana').expect(400);
    });
  });
});
