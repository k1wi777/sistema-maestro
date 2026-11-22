import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, UserRole, type Page, type SharedActivity } from '@gns/shared';
import request from 'supertest';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { auditRows, createPlan, setupPlanning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import {
  asUser,
  createTestUser,
  serverOf,
  signIn,
  type Cookies,
  type TestUser,
} from './support/session';

// La API serializa las fechas como texto ISO; en la prueba se lee el JSON tal cual.
type ActivityBody = Omit<SharedActivity, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};
type PageBody = Omit<Page<ActivityBody>, 'items'> & { items: ActivityBody[] };

const MISSING = '3f2b8c1e-5d4a-4b7e-9a1c-2d6e8f0a1b3c';
const token = () => randomUUID().slice(0, 8);

describe('repositorio de actividades y favoritos (BE-57)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authorUser: TestUser;
  let otherUser: TestUser;
  let author: Cookies;
  let other: Cookies;
  let coordinator: Cookies;
  let admin: Cookies;
  let levelId: string;
  let otherLevelId: string;
  let areaId: string;
  let otherAreaId: string;
  let gradeId: string;
  let otherGradeId: string;

  type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
  const call = (cookies: Cookies, method: Method, path: string) =>
    asUser(app, method, path, cookies, 'access');
  const share = async (cookies: Cookies, body: Record<string, unknown>): Promise<ActivityBody> =>
    (await call(cookies, 'post', '/shared-activities').send(body).expect(201)).body as ActivityBody;
  const search = async (cookies: Cookies, q: string, extra = ''): Promise<string[]> => {
    const res = await call(
      cookies,
      'get',
      `/shared-activities?q=${encodeURIComponent(q)}&pageSize=100${extra}`,
    ).expect(200);
    return (res.body as PageBody).items.map((item) => item.title);
  };
  const listBy = async (cookies: Cookies, query: string): Promise<PageBody> =>
    (await call(cookies, 'get', `/shared-activities?${query}`).expect(200)).body as PageBody;

  beforeAll(async () => {
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    authorUser = await createTestUser(app);
    otherUser = await createTestUser(app);
    author = await signIn(app, authorUser);
    other = await signIn(app, otherUser);
    coordinator = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
    admin = await signIn(app, await createTestUser(app, { role: UserRole.Administrator }));
    const t = token();
    levelId = (await prisma.educationLevel.create({ data: { name: `Nivel ${t}a`, sortOrder: 9 } }))
      .id;
    otherLevelId = (
      await prisma.educationLevel.create({ data: { name: `Nivel ${t}b`, sortOrder: 9 } })
    ).id;
    areaId = (await prisma.area.create({ data: { name: `Área ${t}a`, type: 'asignatura' } })).id;
    otherAreaId = (await prisma.area.create({ data: { name: `Área ${t}b`, type: 'asignatura' } }))
      .id;
    gradeId = (await prisma.grade.create({ data: { name: `Grado ${t}a`, levelId, sortOrder: 1 } }))
      .id;
    otherGradeId = (
      await prisma.grade.create({
        data: { name: `Grado ${t}b`, levelId: otherLevelId, sortOrder: 1 },
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('compartir (R10)', () => {
    it('guarda con el docente como autor y devuelve autor, nivel y área sin correo', async () => {
      const body = await share(author, {
        title: '  Canción del agua  ',
        steps: '1. Cantar.',
        objective: 'Reconocer el ciclo',
        durationMinutes: 45,
        materials: 'Papel',
        link: 'https://ejemplo.test/agua',
        levelId,
        areaId,
      });

      expect(body).toMatchObject({
        title: 'Canción del agua',
        author: { id: authorUser.id },
        level: { id: levelId },
        area: { id: areaId },
        durationMinutes: 45,
        link: 'https://ejemplo.test/agua',
        isFavorite: false,
      });
      expect(JSON.stringify(body)).not.toMatch(/@|mail/i);
      expect(Object.keys(body.author).sort()).toEqual(['fullName', 'id']);
    });

    it('acepta solo título y pasos, con nivel y área nulos', async () => {
      const body = await share(author, { title: 'Mínima', steps: 'Un paso' });

      expect(body).toMatchObject({ level: null, area: null, objective: null, link: null });
    });

    it('responde 400 por campo: obligatorios, nivel o área inexistentes, URL y duración', async () => {
      const fieldsOf = async (body: Record<string, unknown>) => {
        const res = await call(author, 'post', '/shared-activities').send(body).expect(400);
        return (apiErrorBodySchema.parse(res.body).errors ?? []).map((e) => e.field).sort();
      };

      expect(await fieldsOf({})).toEqual(['steps', 'title']);
      expect(await fieldsOf({ title: 'T', steps: 'S', levelId: MISSING, areaId: MISSING })).toEqual(
        ['areaId', 'levelId'],
      );
      expect(await fieldsOf({ title: 'T', steps: 'S', link: 'javascript:alert(1)' })).toEqual([
        'link',
      ]);
      expect(await fieldsOf({ title: 'T', steps: 'S', link: 'ftp://a.test/x' })).toEqual(['link']);
      expect(await fieldsOf({ title: 'T', steps: 'S', durationMinutes: 0 })).toEqual([
        'durationMinutes',
      ]);
    });

    it('rechaza campos desconocidos, incluidos datos de estudiantes (400)', async () => {
      for (const extra of [{ studentName: 'Ana' }, { authorId: authorUser.id }, { id: MISSING }]) {
        await call(author, 'post', '/shared-activities')
          .send({ title: 'T', steps: 'S', ...extra })
          .expect(400);
      }
    });
  });

  describe('listar, ver y filtrar (R11)', () => {
    it('todo docente ve las actividades de otros autores; coordinación y administración no usan el repositorio (403)', async () => {
      const t = token();
      const created = await share(author, { title: `Visible ${t}`, steps: 'Paso' });

      for (const cookies of [author, other]) {
        const detail = await call(cookies, 'get', `/shared-activities/${created.id}`).expect(200);
        expect((detail.body as ActivityBody).title).toBe(`Visible ${t}`);
        expect(await search(cookies, t)).toEqual([`Visible ${t}`]);
      }
      // El repositorio es del trabajo propio del docente: no hay jerarquía que lo abra.
      for (const cookies of [coordinator, admin]) {
        await call(cookies, 'get', `/shared-activities/${created.id}`).expect(403);
        await call(cookies, 'get', '/shared-activities').expect(403);
      }
      await call(other, 'get', `/shared-activities/${MISSING}`).expect(404);
      await call(other, 'get', '/shared-activities/no-uuid').expect(400);
    });

    it('filtra por nivel, área y autor, combinables, y ordena por título', async () => {
      const t = token();
      await share(author, { title: `B ${t}`, steps: 'p', levelId, areaId });
      await share(author, { title: `A ${t}`, steps: 'p', levelId, areaId: otherAreaId });
      await share(other, { title: `C ${t}`, steps: 'p', levelId: otherLevelId, areaId });

      const titles = async (query: string) =>
        (await listBy(author, `q=${t}&pageSize=100&sortBy=title&sortOrder=asc&${query}`)).items.map(
          (item) => item.title,
        );

      expect(await titles('')).toEqual([`A ${t}`, `B ${t}`, `C ${t}`]);
      expect(await titles(`levelId=${levelId}`)).toEqual([`A ${t}`, `B ${t}`]);
      expect(await titles(`areaId=${areaId}`)).toEqual([`B ${t}`, `C ${t}`]);
      expect(await titles(`authorId=${otherUser.id}`)).toEqual([`C ${t}`]);
      expect(await titles(`levelId=${levelId}&areaId=${areaId}&authorId=${authorUser.id}`)).toEqual(
        [`B ${t}`],
      );
      expect(await titles(`levelId=${MISSING}`)).toEqual([]);
      const desc = await listBy(author, `q=${t}&sortBy=title&sortOrder=desc`);
      expect(desc.items.map((item) => item.title)).toEqual([`C ${t}`, `B ${t}`, `A ${t}`]);
      expect(desc).toMatchObject({ page: 1, pageSize: 20, totalItems: 3, totalPages: 1 });
    });

    it('rechaza filtros y órdenes inválidos con 400', async () => {
      for (const query of ['levelId=x', 'sortBy=steps', 'favorites=false', 'favoriteOf=x']) {
        await call(author, 'get', `/shared-activities?${query}`).expect(400);
      }
    });
  });

  describe('búsqueda sin tildes ni mayúsculas (R12)', () => {
    it('encuentra por título, objetivo, materiales y pasos ignorando tildes y mayúsculas', async () => {
      const t = token();
      await share(author, { title: `Canción del agua ${t}`, steps: 'Cantar' });
      await share(author, { title: `El río en el día ${t}`, steps: 'Caminar' });
      await share(author, {
        title: `Otra ${t}`,
        steps: 'Observar el ÁRBOL',
        objective: 'Conocer la Pequeña granja',
        materials: 'Cartulina y lápices',
      });

      expect(await search(author, `CANCION ${t}`)).toEqual([`Canción del agua ${t}`]);
      expect(await search(author, `canción ${t}`)).toEqual([`Canción del agua ${t}`]);
      expect(await search(author, `rio dia ${t}`)).toEqual([`El río en el día ${t}`]);
      expect(await search(author, `arbol ${t}`)).toEqual([`Otra ${t}`]);
      expect(await search(author, `pequena ${t}`)).toEqual([`Otra ${t}`]);
      expect(await search(author, `LAPICES ${t}`)).toEqual([`Otra ${t}`]);
      expect(await search(author, `cancio ${t}`)).toEqual([`Canción del agua ${t}`]);
      expect((await search(author, t)).sort()).toHaveLength(3);
    });

    it('exige todas las palabras y trata % y _ como texto, sin errores con comillas', async () => {
      const t = token();
      await share(author, { title: `Solo agua ${t}`, steps: 'x' });

      expect(await search(author, `agua fuego ${t}`)).toEqual([]);
      expect(await search(author, `%% ${t}`)).toEqual([]);
      expect(await search(author, `_ ${t}`)).toEqual([]);
      expect(await search(author, `'; DROP TABLE usuario; -- ${t}`)).toEqual([]);
      expect(await search(author, `agua ${t}`)).toEqual([`Solo agua ${t}`]);
    });

    it('rechaza una búsqueda de menos de 2 o más de 100 caracteres (400)', async () => {
      await call(author, 'get', '/shared-activities?q=a').expect(400);
      await call(author, 'get', `/shared-activities?q=${'x'.repeat(101)}`).expect(400);
    });
  });

  describe('editar y retirar (R13, R14, R17)', () => {
    it('el autor edita solo lo enviado, vacía con null y queda en la bitácora', async () => {
      const created = await share(author, {
        title: 'Original',
        steps: 'Paso',
        link: 'https://a.test',
      });

      const res = await call(author, 'patch', `/shared-activities/${created.id}`)
        .send({ title: 'Editada', link: null, levelId })
        .expect(200);

      expect(res.body).toMatchObject({
        title: 'Editada',
        link: null,
        steps: 'Paso',
        level: { id: levelId },
      });
      const rows = await auditRows(app, created.id);
      expect(rows.at(-1)).toMatchObject({
        type: 'repositorio',
        action: 'Editó una actividad del repositorio',
        entity: 'actividad_repositorio',
        userId: authorUser.id,
        dataBefore: { title: 'Original', link: 'https://a.test', levelId: null },
        dataAfter: { title: 'Editada', link: null, levelId },
      });
    });

    it('responde 400 al editar sin campos, con nivel inexistente o con campos ajenos', async () => {
      const created = await share(author, { title: 'Para editar', steps: 'Paso' });
      const patch = (body: Record<string, unknown>) =>
        call(author, 'patch', `/shared-activities/${created.id}`).send(body);

      await patch({}).expect(400);
      await patch({ levelId: MISSING }).expect(400);
      await patch({ studentName: 'Ana' }).expect(400);
    });

    it('otro docente recibe 403 al editar y retirar (coordinación y administración, también, por rol); sin existir, 404', async () => {
      const created = await share(author, { title: 'Ajena', steps: 'Paso' });

      for (const cookies of [other, coordinator, admin]) {
        await call(cookies, 'patch', `/shared-activities/${created.id}`)
          .send({ title: 'Robada' })
          .expect(403);
        await call(cookies, 'delete', `/shared-activities/${created.id}`).expect(403);
      }
      expect(
        (await prisma.sharedActivity.findUniqueOrThrow({ where: { id: created.id } })).title,
      ).toBe('Ajena');
      await call(author, 'patch', `/shared-activities/${MISSING}`).send({ title: 'X' }).expect(404);
      await call(other, 'delete', `/shared-activities/${MISSING}`).expect(404);
      // 404 antes que 403 y que 400.
      await call(other, 'patch', `/shared-activities/${MISSING}`)
        .send({ levelId: MISSING })
        .expect(404);
    });

    it('retirar borra la actividad y sus favoritos, y la deja de devolver a todos (R14)', async () => {
      const t = token();
      const created = await share(author, {
        title: `Retirable ${t}`,
        steps: 'Pasos',
        objective: 'Objetivo',
        levelId,
      });
      await call(other, 'put', `/shared-activities/${created.id}/favorite`).expect(204);
      await call(author, 'put', `/shared-activities/${created.id}/favorite`).expect(204);

      await call(author, 'delete', `/shared-activities/${created.id}`).expect(204);

      expect(await prisma.favoriteActivity.count({ where: { activityId: created.id } })).toBe(0);
      expect(await prisma.sharedActivity.count({ where: { id: created.id } })).toBe(0);
      for (const cookies of [author, other]) {
        await call(cookies, 'get', `/shared-activities/${created.id}`).expect(404);
        expect(await search(cookies, t)).toEqual([]);
        expect((await listBy(cookies, `favorites=true&q=${t}`)).items).toEqual([]);
      }
      await call(other, 'put', `/shared-activities/${created.id}/favorite`).expect(404);
      await call(other, 'delete', `/shared-activities/${created.id}/favorite`).expect(404);
      await call(author, 'patch', `/shared-activities/${created.id}`)
        .send({ title: 'X' })
        .expect(404);
      await call(author, 'delete', `/shared-activities/${created.id}`).expect(404);

      const removal = (await auditRows(app, created.id)).at(-1);
      expect(removal).toMatchObject({
        type: 'repositorio',
        action: 'Retiró una actividad del repositorio',
        userId: authorUser.id,
        dataAfter: null,
        dataBefore: {
          id: created.id,
          title: `Retirable ${t}`,
          objective: 'Objetivo',
          steps: 'Pasos',
          levelId,
          authorId: authorUser.id,
        },
      });
    });
  });

  describe('favoritos (R15, R16, R17)', () => {
    it('marcar y desmarcar son idempotentes y responden 204 en la repetición', async () => {
      const created = await share(author, { title: 'Favorita', steps: 'Paso' });
      const path = `/shared-activities/${created.id}/favorite`;

      await call(other, 'put', path).expect(204);
      await call(other, 'put', path).expect(204);
      expect(await prisma.favoriteActivity.count({ where: { activityId: created.id } })).toBe(1);

      await call(other, 'delete', path).expect(204);
      await call(other, 'delete', path).expect(204);
      expect(await prisma.favoriteActivity.count({ where: { activityId: created.id } })).toBe(0);
    });

    it('responde 404 al marcar o desmarcar una actividad inexistente', async () => {
      await call(other, 'put', `/shared-activities/${MISSING}/favorite`).expect(404);
      await call(other, 'delete', `/shared-activities/${MISSING}/favorite`).expect(404);
    });

    it('indica isFavorite según quien consulta y filtra con favorites=true junto a la búsqueda', async () => {
      const t = token();
      const first = await share(author, { title: `Agua ${t}`, steps: 'p', levelId });
      const second = await share(author, { title: `Fuego ${t}`, steps: 'p', levelId });
      await share(author, { title: `Tierra ${t}`, steps: 'p', levelId: otherLevelId });
      await call(other, 'put', `/shared-activities/${first.id}/favorite`).expect(204);
      await call(other, 'put', `/shared-activities/${second.id}/favorite`).expect(204);

      const flags = async (cookies: Cookies): Promise<Record<string, boolean>> => {
        const result: Record<string, boolean> = {};
        for (const item of (await listBy(cookies, `q=${t}&pageSize=100`)).items) {
          result[item.title.split(' ')[0] ?? ''] = item.isFavorite;
        }
        return result;
      };
      expect(await flags(other)).toEqual({ Agua: true, Fuego: true, Tierra: false });
      expect(await flags(author)).toEqual({ Agua: false, Fuego: false, Tierra: false });
      const detail = await call(other, 'get', `/shared-activities/${first.id}`).expect(200);
      expect((detail.body as ActivityBody).isFavorite).toBe(true);

      expect(await search(other, t, '&favorites=true')).toHaveLength(2);
      expect(await search(other, `agua ${t}`, '&favorites=true')).toEqual([`Agua ${t}`]);
      expect(await search(other, t, `&favorites=true&levelId=${otherLevelId}`)).toEqual([]);
      expect(await search(author, t, '&favorites=true')).toEqual([]);
    });

    it('escribe filas de bitácora tipo repositorio con el conteo, también en la repetición', async () => {
      const created = await share(author, { title: 'Auditada', steps: 'Paso' });
      const path = `/shared-activities/${created.id}/favorite`;

      await call(other, 'put', path).expect(204);
      await call(other, 'put', path).expect(204);
      await call(other, 'delete', path).expect(204);

      const [, marked, repeated, unmarked] = await auditRows(app, created.id);
      expect(marked).toMatchObject({
        type: 'repositorio',
        action: 'Marcó una actividad como favorita',
        userId: otherUser.id,
        dataBefore: { favoriteCount: 0 },
        dataAfter: { favoriteCount: 1 },
      });
      expect(repeated).toMatchObject({ action: 'Marcó una actividad como favorita' });
      expect(unmarked).toMatchObject({
        action: 'Desmarcó una actividad favorita',
        dataBefore: { favoriteCount: 1 },
        dataAfter: { favoriteCount: 0 },
      });
    });

    it('compartir deja una fila de bitácora con el contenido', async () => {
      const created = await share(author, { title: 'Registrada', steps: 'Paso' });

      const [row] = await auditRows(app, created.id);

      expect(row).toMatchObject({
        type: 'repositorio',
        action: 'Compartió una actividad del repositorio',
        entity: 'actividad_repositorio',
        userId: authorUser.id,
        dataBefore: null,
        dataAfter: { title: 'Registrada', steps: 'Paso', authorId: authorUser.id },
      });
    });
  });

  describe('grado, rincón y tipo (FE-2)', () => {
    const fieldsOf = async (method: Method, path: string, body: Record<string, unknown>) => {
      const res = await call(author, method, path).send(body).expect(400);
      return (apiErrorBodySchema.parse(res.body).errors ?? []).map((e) => e.field).sort();
    };
    const idsOf = async (query: string) =>
      (await listBy(author, `pageSize=100&${query}`)).items.map((item) => item.title).sort();

    it('guarda y devuelve grado, rincón y tipo; sin tipo guarda actividad y el nivel sale del grado', async () => {
      const full = await share(author, {
        title: 'Completa',
        steps: 'p',
        gradeId,
        learningCorner: '  Sweet Home ',
        activityType: 'juego',
      });
      const minimal = await share(author, { title: 'Sin clasificar', steps: 'p' });

      expect(full).toMatchObject({
        grade: { id: gradeId },
        level: { id: levelId },
        learningCorner: 'Sweet Home',
        activityType: 'juego',
      });
      expect(minimal).toMatchObject({
        grade: null,
        learningCorner: null,
        activityType: 'actividad',
      });
      const detail = await call(other, 'get', `/shared-activities/${full.id}`).expect(200);
      expect(detail.body).toMatchObject({ grade: { id: gradeId }, activityType: 'juego' });
    });

    it('responde 400 por campo: grado inexistente o de otro nivel, tipo y rincón inválidos', async () => {
      const base = { title: 'T', steps: 'S' };

      expect(await fieldsOf('post', '/shared-activities', { ...base, gradeId: MISSING })).toEqual([
        'gradeId',
      ]);
      expect(
        await fieldsOf('post', '/shared-activities', { ...base, gradeId: otherGradeId, levelId }),
      ).toEqual(['gradeId']);
      expect(
        await fieldsOf('post', '/shared-activities', { ...base, activityType: 'taller' }),
      ).toEqual(['activityType']);
      expect(await fieldsOf('post', '/shared-activities', { ...base, activityType: null })).toEqual(
        ['activityType'],
      );
      expect(
        await fieldsOf('post', '/shared-activities', { ...base, learningCorner: 'x'.repeat(61) }),
      ).toEqual(['learningCorner']);
      expect(
        await prisma.sharedActivity.count({ where: { title: 'T', authorId: authorUser.id } }),
      ).toBe(0);
    });

    it('al editar cambia el grado arrastrando el nivel, rechaza incoherencias y vacía con null', async () => {
      const created = await share(author, {
        title: 'Editable',
        steps: 'p',
        gradeId,
        learningCorner: 'Lectura',
        activityType: 'proyecto',
      });
      const path = `/shared-activities/${created.id}`;

      expect(await fieldsOf('patch', path, { levelId: otherLevelId })).toEqual(['gradeId']);
      expect(await fieldsOf('patch', path, { gradeId: otherGradeId, levelId })).toEqual([
        'gradeId',
      ]);
      expect(await fieldsOf('patch', path, { activityType: null })).toEqual(['activityType']);

      const moved = await call(author, 'patch', path).send({ gradeId: otherGradeId }).expect(200);
      expect(moved.body).toMatchObject({
        grade: { id: otherGradeId },
        level: { id: otherLevelId },
        learningCorner: 'Lectura',
        activityType: 'proyecto',
      });

      const cleared = await call(author, 'patch', path)
        .send({ gradeId: null, learningCorner: '  ' })
        .expect(200);
      expect(cleared.body).toMatchObject({
        grade: null,
        learningCorner: null,
        level: { id: otherLevelId },
        title: 'Editable',
        activityType: 'proyecto',
      });

      const typed = await call(author, 'patch', path).send({ activityType: 'video' }).expect(200);
      expect(typed.body).toMatchObject({ activityType: 'video', grade: null });
    });

    it('filtra por grado (con las de todo el nivel), rincón sin tildes, tipo y combinados', async () => {
      const t = token();
      await share(author, {
        title: `G1 ${t}`,
        steps: 'p',
        gradeId,
        learningCorner: 'Zona Matemática',
        activityType: 'juego',
      });
      await share(author, { title: `G2 ${t}`, steps: 'p', levelId, activityType: 'video' });
      await share(author, {
        title: `G3 ${t}`,
        steps: 'p',
        gradeId: otherGradeId,
        learningCorner: 'zona matematica',
        activityType: 'juego',
      });
      await share(author, { title: `G4 ${t}`, steps: 'p', levelId: otherLevelId });

      const q = `q=${t}`;
      expect(await idsOf(`${q}&gradeId=${gradeId}`)).toEqual([`G1 ${t}`, `G2 ${t}`]);
      expect(await idsOf(`${q}&gradeId=${otherGradeId}`)).toEqual([`G3 ${t}`, `G4 ${t}`]);
      expect(await idsOf(`${q}&gradeId=${MISSING}`)).toEqual([]);
      expect(
        await idsOf(`${q}&learningCorner=${encodeURIComponent('  ZONA MATEMÁTICA ')}`),
      ).toEqual([`G1 ${t}`, `G3 ${t}`]);
      expect(await idsOf(`${q}&activityType=juego`)).toEqual([`G1 ${t}`, `G3 ${t}`]);
      expect(await idsOf(`${q}&activityType=video&gradeId=${gradeId}`)).toEqual([`G2 ${t}`]);
      expect(
        await idsOf(`${q}&activityType=juego&gradeId=${gradeId}&learningCorner=zona%20matematica`),
      ).toEqual([`G1 ${t}`]);
      for (const query of ['activityType=taller', 'gradeId=x', 'learningCorner=%20']) {
        await call(author, 'get', `/shared-activities?${query}`).expect(400);
      }
    });

    it('la búsqueda con texto también encuentra por rincón', async () => {
      const t = token();
      await share(author, { title: `Rincón ${t}`, steps: 'p', learningCorner: `Cuentería ${t}` });

      expect(await search(other, `cuenteria ${t}`)).toEqual([`Rincón ${t}`]);
    });

    it('lista los rincones distintos en orden alfabético, sin variantes repetidas y por nivel', async () => {
      const t = token();
      const own = await prisma.educationLevel.create({
        data: { name: `Nivel ${t}c`, sortOrder: 9 },
      });
      await share(author, {
        title: 'r1',
        steps: 'p',
        levelId: own.id,
        learningCorner: `zeta ${t}`,
      });
      await share(author, {
        title: 'r2',
        steps: 'p',
        levelId: own.id,
        learningCorner: `Álamo ${t}`,
      });
      await share(author, {
        title: 'r3',
        steps: 'p',
        levelId: own.id,
        learningCorner: `alamo ${t}`,
      });
      await share(author, { title: 'r4', steps: 'p', levelId: own.id });
      await share(other, { title: 'r5', steps: 'p', learningCorner: `Fuera ${t}` });

      for (const cookies of [author, other]) {
        const res = await call(
          cookies,
          'get',
          `/shared-activities/learning-corners?levelId=${own.id}`,
        ).expect(200);
        expect(res.body).toEqual({ items: [`alamo ${t}`, `zeta ${t}`] });
      }
      const all = (await call(author, 'get', '/shared-activities/learning-corners').expect(200))
        .body as { items: string[] };
      expect(all.items).toEqual(expect.arrayContaining([`Fuera ${t}`, `zeta ${t}`]));
      expect(all.items.filter((item) => item.toLowerCase().includes(`alamo ${t}`))).toHaveLength(1);
      await call(author, 'get', '/shared-activities/learning-corners?levelId=x').expect(400);
    });

    it('registra grado, rincón y tipo en la bitácora al compartir, editar y retirar', async () => {
      const created = await share(author, {
        title: 'Auditada',
        steps: 'p',
        gradeId,
        learningCorner: 'Sweet Home',
        activityType: 'juego',
      });
      await call(author, 'patch', `/shared-activities/${created.id}`)
        .send({ gradeId: null, learningCorner: null, activityType: 'video' })
        .expect(200);
      await call(author, 'delete', `/shared-activities/${created.id}`).expect(204);

      const [shared, edited, removed] = await auditRows(app, created.id);

      expect(shared?.dataAfter).toMatchObject({
        gradeId,
        learningCorner: 'Sweet Home',
        activityType: 'juego',
      });
      expect(edited?.dataBefore).toMatchObject({
        gradeId,
        learningCorner: 'Sweet Home',
        activityType: 'juego',
      });
      expect(edited?.dataAfter).toMatchObject({
        gradeId: null,
        learningCorner: null,
        activityType: 'video',
      });
      expect(removed?.dataBefore).toMatchObject({
        gradeId: null,
        learningCorner: null,
        activityType: 'video',
      });
    });
  });

  describe('herencia desde una planeación (FE-2, R14)', () => {
    let release: () => Promise<void>;

    beforeAll(async () => {
      release = await holdSchoolYearLock('shared');
    }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

    afterAll(async () => {
      await release();
    });

    it('comparte con el grado y el rincón de una planeación creada por la API, sin enviar el nivel', async () => {
      const planning = await setupPlanning(app);
      const target = await planning.gradeAndArea('Bachillerato');
      await planning.assign(authorUser.id, target.gradeId, target.areaId);
      const plan = await createPlan(app, author, {
        ...target,
        periodId: planning.periods[1],
        learningCorner: 'Zona STEAM+H',
      });

      const activity = await share(author, {
        title: 'Desde la planeación',
        steps: 'p',
        areaId: plan.areas[0]?.id,
        gradeId: plan.grade.id,
        learningCorner: plan.learningCorner,
      });

      expect(activity).toMatchObject({
        grade: { id: plan.grade.id },
        level: { id: plan.level.id },
        area: { id: plan.areas[0]?.id },
        learningCorner: 'Zona STEAM+H',
      });
    });
  });

  it('exige sesión en todas las rutas (R18)', async () => {
    const server = serverOf(app);
    await request(server).get('/shared-activities').expect(401);
    await request(server).get('/shared-activities/learning-corners').expect(401);
    await request(server).post('/shared-activities').send({}).expect(401);
    await request(server).put(`/shared-activities/${MISSING}/favorite`).expect(401);
  });
});
