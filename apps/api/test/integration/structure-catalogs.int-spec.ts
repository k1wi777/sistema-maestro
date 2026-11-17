import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, AreaType, UserRole, UserStatus } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { asUser, createTestUser, signIn, type Cookies } from './support/session';

interface Item {
  id: string;
  name?: string;
  sortOrder?: number;
  levelId?: string;
  type?: string;
  active?: boolean;
  levelIds?: string[];
  gradeId?: string;
  coordinatorId?: string | null;
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

  type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
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
      const level = await createLevel();
      await as(admin, 'post', '/areas')
        .send({ name, type: AreaType.Dimension, levelIds: [level.id] })
        .expect(201);

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

  describe('escritura (R2, R3, R6)', () => {
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
          .send({ name: `Área ${unique()}`, type: 'asignatura', levelIds: [level.id] })
          .expect(201)
      ).body as Item;
      expect(area).toMatchObject({ active: true, levelIds: [level.id] });
      const retyped = await as(admin, 'patch', `/areas/${area.id}`)
        .send({ type: 'dimension' })
        .expect(200);
      expect(retyped.body).toMatchObject({ type: 'dimension' });
    });

    it('los niveles no se borran por la API y un PATCH a un id inexistente responde 404', async () => {
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
        await as(admin, 'post', '/areas').send({
          name: `Área ${unique()}`,
          type: 'asignatura',
          levelIds: [level.id],
        })
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
      await as(admin, 'post', '/areas')
        .send({ name: area.name, type: 'dimension', levelIds: [level.id] })
        .expect(409);
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

      const gradeRows = await auditRows('grado', grade.id);
      expect(gradeRows).toHaveLength(1);
      expect(gradeRows[0]?.type).toBe('estructura');
      expect(await auditRows('periodo_academico', period.id)).toHaveLength(1);
      expect(
        await prisma.auditLog.count({
          where: { entity: 'anio_lectivo', action: 'Registrar año lectivo' },
        }),
      ).toBeGreaterThan(0);
    });
  });
  describe('grados, grupos, áreas y coordinación por grado', () => {
    const gradeBody = (levelId: string) => ({ name: `Grado ${unique()}`, levelId, sortOrder: 1 });

    async function levelWithGrade() {
      const level = await createLevel();
      const grade = await createGrade(level.id);
      return { level, grade };
    }
    async function createGroup(gradeId: string, name = `Grupo ${unique()}`, cookies = coordinator) {
      const res = await as(cookies, 'post', '/groups').send({ gradeId, name }).expect(201);
      return res.body as Item;
    }
    async function createArea(levelIds: string[], name = `Área ${unique()}`) {
      const res = await as(coordinator, 'post', '/areas')
        .send({ name, type: 'asignatura', levelIds })
        .expect(201);
      return res.body as Item;
    }
    async function assignTo(groupId: string, areaId: string) {
      const code = randomSchoolYear();
      await prisma.schoolYear.create({ data: { code } });
      const teacherUser = await createTestUser(app);
      await prisma.teacherAssignment.create({
        data: { teacherId: teacherUser.id, groupId, areaId, schoolYear: code },
      });
    }

    it('un docente recibe 403 en todas las escrituras y en la lectura de la página; coordinación y administración, 2xx (R1)', async () => {
      const { level, grade } = await levelWithGrade();
      const group = await createGroup(grade.id);
      const area = await createArea([level.id]);
      const someone = await createTestUser(app, { role: UserRole.Coordinator });
      const attempts: [Method, string, object?][] = [
        ['post', '/grades', gradeBody(level.id)],
        ['patch', `/grades/${grade.id}`, { active: false }],
        ['delete', `/grades/${grade.id}`],
        ['post', '/groups', { gradeId: grade.id, name: 'X' }],
        ['patch', `/groups/${group.id}`, { active: false }],
        ['delete', `/groups/${group.id}`],
        ['post', '/areas', { name: 'X', type: 'asignatura', levelIds: [level.id] }],
        ['patch', `/areas/${area.id}`, { active: false }],
        ['delete', `/areas/${area.id}`],
        ['put', `/coordinators/${someone.id}/grades`, { gradeIds: [] }],
        ['get', '/academic-structure'],
      ];

      for (const [method, path, body] of attempts) {
        const res = await as(teacher, method, path).send(body);
        expect([method, path, res.status]).toEqual([method, path, 403]);
      }
      expect(await prisma.group.count({ where: { id: group.id } })).toBe(1);

      await as(admin, 'post', '/groups')
        .send({ gradeId: grade.id, name: `A ${unique()}` })
        .expect(201);
      await as(coordinator, 'get', '/academic-structure').expect(200);
      await as(admin, 'get', '/academic-structure').expect(200);
    });

    it('grupos: nombre único dentro del grado, grado existente y listado con filtros (R1)', async () => {
      const { grade } = await levelWithGrade();
      const other = (await levelWithGrade()).grade;
      const group = await createGroup(grade.id, 'Kinder 1');

      // El mismo nombre en otro grado sí se admite.
      await createGroup(other.id, 'Kinder 1');
      const duplicate = await as(coordinator, 'post', '/groups')
        .send({ gradeId: grade.id, name: 'Kinder 1' })
        .expect(409);
      expect(apiErrorBodySchema.parse(duplicate.body).code).toBe('conflicto');
      const missing = await as(coordinator, 'post', '/groups')
        .send({ gradeId: randomUUID(), name: 'Z' })
        .expect(400);
      expect(apiErrorBodySchema.parse(missing.body).errors?.[0]?.field).toBe('gradeId');
      await as(coordinator, 'patch', `/groups/${group.id}`).send({}).expect(400);
      await as(coordinator, 'patch', `/groups/${group.id}`).send({ gradeId: other.id }).expect(400);

      await as(coordinator, 'patch', `/groups/${group.id}`).send({ active: false }).expect(200);
      const inactive = await as(teacher, 'get', `/groups?gradeId=${grade.id}&active=false`).expect(
        200,
      );
      expect((inactive.body as PageBody).items.map((g) => g.id)).toEqual([group.id]);
      const active = await as(teacher, 'get', `/groups?gradeId=${grade.id}&active=true`).expect(
        200,
      );
      expect((active.body as PageBody).totalItems).toBe(0);
    });

    it('borra un grupo sin uso y rechaza con 409 el que tiene asignaciones, indicando cuántas (R2, R3)', async () => {
      const { level, grade } = await levelWithGrade();
      const free = await createGroup(grade.id);
      const used = await createGroup(grade.id);
      const area = await createArea([level.id]);
      await assignTo(used.id, area.id);

      await as(coordinator, 'delete', `/groups/${free.id}`).expect(204);
      expect(await prisma.group.count({ where: { id: free.id } })).toBe(0);

      const res = await as(coordinator, 'delete', `/groups/${used.id}`).expect(409);
      expect(apiErrorBodySchema.parse(res.body)).toMatchObject({ code: 'catalogo_en_uso' });
      expect(apiErrorBodySchema.parse(res.body).message).toContain('1 registro');
      expect(await prisma.group.count({ where: { id: used.id } })).toBe(1);
      await as(coordinator, 'delete', `/groups/${randomUUID()}`).expect(404);
    });

    it('borra un grado sin uso con sus grupos y rechaza el que está en uso sin borrar nada (R2, R3)', async () => {
      const { level, grade } = await levelWithGrade();
      const group = await createGroup(grade.id);
      await as(coordinator, 'delete', `/grades/${grade.id}`).expect(204);
      expect(await prisma.grade.count({ where: { id: grade.id } })).toBe(0);
      expect(await prisma.group.count({ where: { id: group.id } })).toBe(0);

      const usedGrade = await createGrade(level.id);
      const usedGroup = await createGroup(usedGrade.id);
      await createGroup(usedGrade.id);
      const area = await createArea([level.id]);
      await assignTo(usedGroup.id, area.id);
      const res = await as(coordinator, 'delete', `/grades/${usedGrade.id}`).expect(409);
      expect(apiErrorBodySchema.parse(res.body).code).toBe('catalogo_en_uso');
      expect(await prisma.group.count({ where: { gradeId: usedGrade.id } })).toBe(2);

      // También cuenta un registro pedagógico anulado (planeación, diario, observador…).
      const noted = await createGrade(level.id);
      const author = await createTestUser(app);
      await prisma.observerNote.create({
        data: {
          teacherId: author.id,
          gradeId: noted.id,
          studentFirstName: 'Sofía',
          date: new Date('2031-03-10'),
          type: 'positiva',
          description: 'Descripción',
          status: 'anulado',
        },
      });
      await as(coordinator, 'delete', `/grades/${noted.id}`).expect(409);
    });

    it('un área se borra con su relación con los niveles si no está en uso; en uso, 409 (R2, R3)', async () => {
      const { level, grade } = await levelWithGrade();
      const free = await createArea([level.id]);
      const used = await createArea([level.id]);
      await assignTo(await createGroup(grade.id).then((g) => g.id), used.id);

      await as(coordinator, 'delete', `/areas/${free.id}`).expect(204);
      expect(await prisma.area.count({ where: { id: free.id } })).toBe(0);
      expect(await prisma.areaLevel.count({ where: { areaId: free.id } })).toBe(0);

      const res = await as(coordinator, 'delete', `/areas/${used.id}`).expect(409);
      expect(apiErrorBodySchema.parse(res.body).code).toBe('catalogo_en_uso');
      expect(await prisma.areaLevel.count({ where: { areaId: used.id } })).toBe(1);
    });

    it('no permite cambiar el nivel de un grado en uso (R4), pero sí el de uno sin uso', async () => {
      const { level, grade } = await levelWithGrade();
      const other = await createLevel();
      const free = await createGrade(level.id);
      const area = await createArea([level.id]);
      await assignTo((await createGroup(grade.id)).id, area.id);

      await as(coordinator, 'patch', `/grades/${grade.id}`).send({ levelId: other.id }).expect(409);
      expect((await prisma.grade.findUniqueOrThrow({ where: { id: grade.id } })).levelId).toBe(
        level.id,
      );
      await as(coordinator, 'patch', `/grades/${free.id}`).send({ levelId: other.id }).expect(200);
      // Renombrar o desactivar un grado en uso sí se puede.
      await as(coordinator, 'patch', `/grades/${grade.id}`)
        .send({ name: `Grado ${unique()}`, active: false })
        .expect(200);
    });

    it('un área sin niveles o con un nivel inexistente se rechaza con 400 en el campo; editar reemplaza los niveles (R5)', async () => {
      const level = await createLevel();
      const other = await createLevel();

      await as(coordinator, 'post', '/areas')
        .send({ name: `Área ${unique()}`, type: 'asignatura', levelIds: [] })
        .expect(400);
      const unknown = await as(coordinator, 'post', '/areas')
        .send({ name: `Área ${unique()}`, type: 'asignatura', levelIds: [level.id, randomUUID()] })
        .expect(400);
      expect(apiErrorBodySchema.parse(unknown.body).errors?.[0]?.field).toBe('levelIds.1');

      const area = await createArea([level.id]);
      await as(coordinator, 'patch', `/areas/${area.id}`).send({ levelIds: [] }).expect(400);
      const edited = await as(coordinator, 'patch', `/areas/${area.id}`)
        .send({ levelIds: [other.id], active: false })
        .expect(200);
      expect(edited.body).toMatchObject({ levelIds: [other.id], active: false });
      const byLevel = await as(teacher, 'get', `/areas?levelId=${other.id}&active=false`).expect(
        200,
      );
      expect((byLevel.body as PageBody).items.map((a) => a.id)).toEqual([area.id]);
    });

    it('coordinadoras: cada grado tiene a lo sumo una; reasignar quita el grado a la anterior y se puede dejar sin coordinadora (R6)', async () => {
      const level = await createLevel();
      const [first, second, third] = [
        await createGrade(level.id),
        await createGrade(level.id),
        await createGrade(level.id),
      ];
      const [ana, beto] = [
        await createTestUser(app, { role: UserRole.Coordinator }),
        await createTestUser(app, { role: UserRole.Coordinator }),
      ];
      const put = (id: string, gradeIds: string[]) =>
        as(coordinator, 'put', `/coordinators/${id}/grades`).send({ gradeIds });

      const initial = await put(ana.id, [first.id, second.id]).expect(200);
      expect((initial.body as { gradeIds: string[] }).gradeIds.sort()).toEqual(
        [first.id, second.id].sort(),
      );
      // Beto toma el segundo grado: Ana conserva solo el primero.
      await put(beto.id, [second.id, third.id]).expect(200);
      const coordinatorOf = async (id: string) =>
        (await prisma.grade.findUniqueOrThrow({ where: { id } })).coordinatorId;
      expect([await coordinatorOf(first.id), await coordinatorOf(second.id)]).toEqual([
        ana.id,
        beto.id,
      ]);
      // Dejar a Ana sin grados los deja sin coordinadora.
      await put(ana.id, []).expect(200);
      expect(await coordinatorOf(first.id)).toBeNull();

      const rows = await auditRows('coordinacion_grado', ana.id);
      // Solo las peticiones sobre Ana: la de Beto no la toca como entidad (quitarle el segundo grado
      // queda en el antes y después de las filas de Beto).
      expect(rows.map((row) => row.action)).toEqual([
        'Cambiar los grados de una coordinadora',
        'Cambiar los grados de una coordinadora',
      ]);
      expect(rows[0]).toMatchObject({ type: 'estructura' });
      expect(rows[0]?.dataBefore).toMatchObject({ gradeIds: [] });
      expect((rows[0]?.dataAfter as { gradeIds: string[] }).gradeIds).toHaveLength(2);
    });

    it('coordinadoras: 404 si el usuario no existe y 400 si no es coordinador activo o el grado no existe', async () => {
      const level = await createLevel();
      const grade = await createGrade(level.id);
      const aTeacher = await createTestUser(app);
      const inactive = await createTestUser(app, {
        role: UserRole.Coordinator,
        status: UserStatus.Inactive,
      });
      const live = await createTestUser(app, { role: UserRole.Coordinator });
      const before = await prisma.auditLog.count({ where: { entity: 'coordinacion_grado' } });
      const put = (id: string, gradeIds: string[]) =>
        as(coordinator, 'put', `/coordinators/${id}/grades`).send({ gradeIds });

      await put(randomUUID(), []).expect(404);
      await put(aTeacher.id, [grade.id]).expect(400);
      await put(inactive.id, [grade.id]).expect(400);
      const unknown = await put(live.id, [grade.id, randomUUID()]).expect(400);
      expect(apiErrorBodySchema.parse(unknown.body).errors?.[0]?.field).toBe('gradeIds.1');
      await put(live.id, [grade.id, grade.id]).expect(400);

      expect(await prisma.auditLog.count({ where: { entity: 'coordinacion_grado' } })).toBe(before);
      expect(
        (await prisma.grade.findUniqueOrThrow({ where: { id: grade.id } })).coordinatorId,
      ).toBeNull();
    });

    it('GET /academic-structure devuelve niveles, grados, grupos, áreas con uso y coordinadoras, sin correos (R16)', async () => {
      const { level, grade } = await levelWithGrade();
      const group = await createGroup(grade.id, 'Kinder 2');
      await createGroup(grade.id, 'Kinder 10');
      const area = await createArea([level.id]);
      await assignTo(group.id, area.id);
      const coord = await createTestUser(app, { role: UserRole.Coordinator });
      await as(coordinator, 'put', `/coordinators/${coord.id}/grades`)
        .send({ gradeIds: [grade.id] })
        .expect(200);

      const res = await as(coordinator, 'get', '/academic-structure').expect(200);
      const body = res.body as {
        levels: {
          id: string;
          grades: {
            id: string;
            inUse: boolean;
            coordinator: { id: string } | null;
            groups: { name: string; inUse: boolean }[];
          }[];
        }[];
        areas: { id: string; usageCount: number; levelIds: string[] }[];
        coordinators: { id: string; gradeIds: string[] }[];
      };

      const entry = body.levels
        .find((l) => l.id === level.id)
        ?.grades.find((g) => g.id === grade.id);
      expect(entry).toMatchObject({ inUse: true, coordinator: { id: coord.id } });
      // Orden natural de los grupos y uso por grupo.
      expect(entry?.groups.map((g) => [g.name, g.inUse])).toEqual([
        ['Kinder 2', true],
        ['Kinder 10', false],
      ]);
      expect(body.areas.find((a) => a.id === area.id)).toMatchObject({
        usageCount: 1,
        levelIds: [level.id],
      });
      expect(body.coordinators.find((c) => c.id === coord.id)?.gradeIds).toEqual([grade.id]);
      expect(JSON.stringify(res.body)).not.toContain('@');
    });

    it('registra cada escritura en la bitácora «estructura» con antes y después, y no deja fila si falla (R7)', async () => {
      const { level, grade } = await levelWithGrade();
      const group = await createGroup(grade.id);
      const area = await createArea([level.id]);
      await as(coordinator, 'patch', `/groups/${group.id}`).send({ active: false }).expect(200);
      await as(coordinator, 'patch', `/areas/${area.id}`).send({ active: false }).expect(200);
      await as(coordinator, 'delete', `/groups/${group.id}`).expect(204);

      const groupRows = await auditRows('grupo', group.id);
      expect(groupRows.map((row) => row.action)).toEqual([
        'Crear grupo',
        'Editar grupo',
        'Borrar grupo',
      ]);
      expect(groupRows.every((row) => row.type === 'estructura')).toBe(true);
      expect(groupRows[1]?.dataBefore).toMatchObject({ active: true });
      expect(groupRows[1]?.dataAfter).toMatchObject({ active: false });
      expect(groupRows[2]).toMatchObject({ dataAfter: null });
      expect(groupRows[2]?.dataBefore).toMatchObject({ id: group.id });
      const areaRows = await auditRows('area', area.id);
      expect(areaRows.map((row) => row.action)).toEqual(['Crear área', 'Editar área']);

      const used = await createGroup(grade.id);
      await assignTo(used.id, area.id);
      const count = () => prisma.auditLog.count({ where: { entity: 'grupo' } });
      const before = await count();
      await as(coordinator, 'delete', `/groups/${used.id}`).expect(409);
      await as(coordinator, 'post', '/groups')
        .send({ gradeId: grade.id, name: used.name })
        .expect(409);
      expect(await count()).toBe(before);
    });
  });
});
