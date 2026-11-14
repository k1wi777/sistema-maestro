import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, AreaType, UserRole } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { asUser, createTestUser, signIn, type Cookies } from './support/session';

interface Item {
  id: string;
  name?: string;
  sortOrder?: number;
  levelId?: string;
  type?: string;
  schoolYear?: string;
  number?: number;
  startDate?: string | null;
  endDate?: string | null;
}
interface PageBody {
  items: Item[];
  totalItems: number;
}

// Los demás archivos comparten la base y Jest los ejecuta en paralelo: cada archivo crea sus
// datos con nombres aleatorios y este no toca el año vigente (solo lo hace teacher-assignments).
const unique = () => randomUUID().slice(0, 8);
function randomSchoolYear(): string {
  const start = 3000 + Math.floor(Math.random() * 6000);
  return `${start}-${start + 1}`;
}

describe('catálogos académicos', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Cookies;
  let adminId: string;
  let coordinator: Cookies;
  let teacher: Cookies;

  beforeAll(async () => {
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    const adminUser = await createTestUser(app, { role: UserRole.Administrator });
    adminId = adminUser.id;
    admin = await signIn(app, adminUser);
    coordinator = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
    teacher = await signIn(app, await createTestUser(app));
  });

  afterAll(async () => {
    await app.close();
  });

  type Method = 'get' | 'post' | 'patch' | 'delete';
  const as = (cookies: Cookies, method: Method, path: string) =>
    asUser(app, method, path, cookies, 'access');

  async function createLevel(sortOrder = 1) {
    const res = await as(admin, 'post', '/levels')
      .send({ name: `Nivel ${unique()}`, sortOrder })
      .expect(201);
    return res.body as Item;
  }
  async function createGrade(levelId: string, sortOrder = 1) {
    const res = await as(admin, 'post', '/grades')
      .send({ name: `Grado ${unique()}`, levelId, sortOrder })
      .expect(201);
    return res.body as Item;
  }
  async function registerYear(code = randomSchoolYear()) {
    await as(admin, 'post', '/school-years').send({ code }).expect(201);
    return code;
  }
  const auditRows = (entity: string, entityId: string) =>
    prisma.auditLog.findMany({ where: { entity, entityId }, orderBy: { id: 'asc' } });

  describe('lectura (R1)', () => {
    it('los tres roles listan niveles, grados, áreas y periodos', async () => {
      for (const cookies of [teacher, coordinator, admin]) {
        for (const path of ['/levels', '/grades', '/areas', '/academic-periods']) {
          const res = await as(cookies, 'get', `${path}?pageSize=100`).expect(200);
          expect((res.body as PageBody).items).toBeInstanceOf(Array);
        }
      }
    });

    it('filtra los grados por nivel y ordena por defecto por sortOrder', async () => {
      const level = await createLevel();
      const second = await createGrade(level.id, 20);
      const first = await createGrade(level.id, 10);
      await createGrade((await createLevel()).id);

      const res = await as(teacher, 'get', `/grades?levelId=${level.id}`).expect(200);

      expect((res.body as PageBody).items.map((g) => g.id)).toEqual([first.id, second.id]);
      expect((res.body as PageBody).totalItems).toBe(2);
    });

    it('lista los niveles por sortOrder y permite ordenar por nombre', async () => {
      const res = await as(teacher, 'get', '/levels?pageSize=100').expect(200);
      const orders = (res.body as PageBody).items.map((item) => item.sortOrder ?? 0);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));

      await as(teacher, 'get', '/levels?sortBy=name&sortOrder=desc').expect(200);
    });

    it('filtra las áreas por tipo y las ordena por nombre', async () => {
      const name = `Área ${unique()}`;
      await as(admin, 'post', '/areas').send({ name, type: AreaType.Dimension }).expect(201);

      const res = await as(teacher, 'get', '/areas?type=dimension&pageSize=100').expect(200);
      const items = (res.body as PageBody).items;

      expect(items.every((area) => area.type === 'dimension')).toBe(true);
      expect(items.some((area) => area.name === name)).toBe(true);
      const names = items.map((area) => area.name ?? '');
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it('rechaza parámetros desconocidos y valores inválidos con 400', async () => {
      await as(teacher, 'get', '/levels?foo=1').expect(400);
      await as(teacher, 'get', '/areas?type=otro').expect(400);
      await as(teacher, 'get', '/grades?levelId=no-uuid').expect(400);
    });

    it('lista los periodos de un año por número ascendente y los años más recientes primero', async () => {
      const older = await registerYear('3101-3102');
      const newer = await registerYear('3102-3103');
      for (const number of [3, 1, 2]) {
        await as(admin, 'post', '/academic-periods')
          .send({ schoolYear: older, number })
          .expect(201);
      }
      await as(admin, 'post', '/academic-periods')
        .send({ schoolYear: newer, number: 1 })
        .expect(201);

      const one = await as(teacher, 'get', `/academic-periods?schoolYear=${older}`).expect(200);
      expect((one.body as PageBody).items.map((p) => p.number)).toEqual([1, 2, 3]);

      const all = await as(teacher, 'get', '/academic-periods?pageSize=100').expect(200);
      const years = (all.body as PageBody).items.map((p) => p.schoolYear);
      expect(years.indexOf(newer)).toBeLessThan(years.indexOf(older));
    });
  });

  describe('escritura solo para administración (R2, R3, R6)', () => {
    it('el administrador crea y edita niveles, grados y áreas', async () => {
      const level = await createLevel(3);
      expect(level).toMatchObject({ sortOrder: 3 });
      const renamed = `Nivel ${unique()}`;
      const edited = await as(admin, 'patch', `/levels/${level.id}`)
        .send({ name: renamed, sortOrder: 4 })
        .expect(200);
      expect(edited.body).toMatchObject({ id: level.id, name: renamed, sortOrder: 4 });

      const otherLevel = await createLevel();
      const grade = await createGrade(level.id);
      const moved = await as(admin, 'patch', `/grades/${grade.id}`)
        .send({ levelId: otherLevel.id })
        .expect(200);
      expect(moved.body).toMatchObject({ id: grade.id, levelId: otherLevel.id });

      const area = (
        await as(admin, 'post', '/areas')
          .send({ name: `Área ${unique()}`, type: 'asignatura' })
          .expect(201)
      ).body as Item;
      const retyped = await as(admin, 'patch', `/areas/${area.id}`)
        .send({ type: 'dimension' })
        .expect(200);
      expect(retyped.body).toMatchObject({ type: 'dimension' });
    });

    it('no hay borrado por la API y un PATCH a un id inexistente responde 404', async () => {
      const level = await createLevel();

      await as(admin, 'delete', `/levels/${level.id}`).expect(404);
      expect(await prisma.educationLevel.count({ where: { id: level.id } })).toBe(1);
      await as(admin, 'patch', `/levels/${randomUUID()}`).send({ name: 'X' }).expect(404);
    });

    it('rechaza con 400 un PATCH vacío y campos desconocidos', async () => {
      const level = await createLevel();

      await as(admin, 'patch', `/levels/${level.id}`).send({}).expect(400);
      await as(admin, 'patch', `/levels/${level.id}`).send({ foo: 1 }).expect(400);
      await as(admin, 'post', '/levels').send({ name: '', sortOrder: 1 }).expect(400);
      await as(admin, 'post', '/levels').send({ name: 'Ok', sortOrder: 40000 }).expect(400);
    });
  });

  describe('conflictos y referencias (R4, R5)', () => {
    it('responde 409 con el dato repetido, también al renombrar, y no deja filas de más', async () => {
      const level = await createLevel();
      const other = await createLevel();
      const grade = await createGrade(level.id);
      const area = (
        await as(admin, 'post', '/areas').send({ name: `Área ${unique()}`, type: 'asignatura' })
      ).body as Item;

      const dupLevel = await as(admin, 'post', '/levels')
        .send({ name: level.name, sortOrder: 1 })
        .expect(409);
      expect(apiErrorBodySchema.parse(dupLevel.body)).toMatchObject({
        code: 'conflicto',
        message: 'Ya existe un nivel con ese nombre',
      });
      await as(admin, 'patch', `/levels/${other.id}`).send({ name: level.name }).expect(409);
      await as(admin, 'post', '/grades')
        .send({ name: grade.name, levelId: level.id, sortOrder: 1 })
        .expect(409);
      await as(admin, 'post', '/areas').send({ name: area.name, type: 'dimension' }).expect(409);
      expect(await prisma.educationLevel.count({ where: { name: level.name } })).toBe(1);
      // Conservar el propio nombre no es un conflicto.
      await as(admin, 'patch', `/levels/${level.id}`)
        .send({ name: level.name, sortOrder: 2 })
        .expect(200);
    });

    it('responde 409 con el mismo año y número de periodo', async () => {
      const year = await registerYear();
      await as(admin, 'post', '/academic-periods')
        .send({ schoolYear: year, number: 1 })
        .expect(201);

      const res = await as(admin, 'post', '/academic-periods')
        .send({ schoolYear: year, number: 1 })
        .expect(409);

      expect(apiErrorBodySchema.parse(res.body).code).toBe('conflicto');
    });

    it('responde 400 señalando el campo con un nivel inexistente al crear y al editar un grado', async () => {
      const level = await createLevel();
      const grade = await createGrade(level.id);

      const created = await as(admin, 'post', '/grades')
        .send({ name: `Grado ${unique()}`, levelId: randomUUID(), sortOrder: 1 })
        .expect(400);
      expect(apiErrorBodySchema.parse(created.body)).toMatchObject({
        code: 'validacion',
        errors: [{ field: 'levelId' }],
      });
      await as(admin, 'patch', `/grades/${grade.id}`).send({ levelId: randomUUID() }).expect(400);
    });

    it('responde 400 con un periodo de un año no registrado o con fechas invertidas', async () => {
      const unregistered = await as(admin, 'post', '/academic-periods')
        .send({ schoolYear: '1998-1999', number: 1 })
        .expect(400);
      expect(apiErrorBodySchema.parse(unregistered.body).errors?.[0]?.field).toBe('schoolYear');

      const inverted = await as(admin, 'post', '/academic-periods')
        .send({
          schoolYear: await registerYear(),
          number: 1,
          startDate: '2027-01-02',
          endDate: '2027-01-01',
        })
        .expect(400);
      expect(apiErrorBodySchema.parse(inverted.body).errors?.[0]?.field).toBe('startDate');
    });
  });

  describe('periodos: edición (R6)', () => {
    async function createPeriod() {
      const year = await registerYear();
      const res = await as(admin, 'post', '/academic-periods')
        .send({ schoolYear: year, number: 2, startDate: '2027-02-01', endDate: '2027-04-30' })
        .expect(201);
      return res.body as Item;
    }

    it('edita solo las fechas y las devuelve como AAAA-MM-DD', async () => {
      const period = await createPeriod();
      expect(period).toMatchObject({ startDate: '2027-02-01', endDate: '2027-04-30' });

      const res = await as(admin, 'patch', `/academic-periods/${period.id}`)
        .send({ endDate: '2027-05-15' })
        .expect(200);
      expect(res.body).toMatchObject({
        schoolYear: period.schoolYear,
        number: 2,
        startDate: '2027-02-01',
        endDate: '2027-05-15',
      });
      const cleared = await as(admin, 'patch', `/academic-periods/${period.id}`)
        .send({ startDate: null })
        .expect(200);
      expect((cleared.body as Item).startDate).toBeNull();
    });

    it('rechaza con 400 cambiar el año o el número y fechas invertidas contra lo guardado', async () => {
      const period = await createPeriod();

      await as(admin, 'patch', `/academic-periods/${period.id}`)
        .send({ schoolYear: '2030-2031' })
        .expect(400);
      await as(admin, 'patch', `/academic-periods/${period.id}`).send({ number: 3 }).expect(400);
      await as(admin, 'patch', `/academic-periods/${period.id}`)
        .send({ startDate: '2027-06-01' })
        .expect(400);
      const stored = await prisma.academicPeriod.findUniqueOrThrow({ where: { id: period.id } });
      expect(stored).toMatchObject({ schoolYear: period.schoolYear, number: 2 });
    });
  });

  describe('bitácora (R16)', () => {
    it('registra la creación y la edición con el estado antes y después', async () => {
      const level = await createLevel(5);
      await as(admin, 'patch', `/levels/${level.id}`).send({ sortOrder: 6 }).expect(200);

      const rows = await auditRows('nivel', level.id);

      expect(rows.map((row) => row.action)).toEqual(['Crear nivel', 'Editar nivel']);
      expect(rows[0]).toMatchObject({
        userId: adminId,
        type: 'coordinacion',
        dataBefore: null,
        dataAfter: expect.objectContaining({ name: level.name, sortOrder: 5 }) as unknown,
      });
      expect(rows[1]?.dataBefore).toMatchObject({ sortOrder: 5 });
      expect(rows[1]?.dataAfter).toMatchObject({ sortOrder: 6 });
    });

    it('no deja fila si la escritura falla', async () => {
      const level = await createLevel();
      const before = await prisma.auditLog.count({
        where: { type: 'coordinacion', entity: 'nivel' },
      });

      await as(admin, 'post', '/levels').send({ name: level.name, sortOrder: 1 }).expect(409);
      await as(admin, 'patch', `/levels/${randomUUID()}`).send({ name: 'X' }).expect(404);

      expect(
        await prisma.auditLog.count({ where: { type: 'coordinacion', entity: 'nivel' } }),
      ).toBe(before);
    });

    it('audita grados, áreas y periodos', async () => {
      const level = await createLevel();
      const grade = await createGrade(level.id);
      const year = await registerYear();
      const period = (
        await as(admin, 'post', '/academic-periods')
          .send({ schoolYear: year, number: 1 })
          .expect(201)
      ).body as Item;

      expect(await auditRows('grado', grade.id)).toHaveLength(1);
      expect(await auditRows('periodo_academico', period.id)).toHaveLength(1);
      expect(
        await prisma.auditLog.count({
          where: { entity: 'anio_lectivo', action: 'Registrar año lectivo' },
        }),
      ).toBeGreaterThan(0);
    });
  });
});
