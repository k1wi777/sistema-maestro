import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, UserRole, UserStatus } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { asUser, createTestUser, signIn, type Cookies, type TestUser } from './support/session';

interface YearBody {
  id: string;
  code: string;
  isCurrent: boolean;
}
interface AssignmentBody {
  id: string;
  schoolYear: string;
  status: string;
  isHomeroomTeacher: boolean;
  teacher: Record<string, unknown>;
  group: { id: string; name: string };
  grade: { id: string; name: string };
  level: { id: string; name: string };
  area: { id: string; name: string };
}
interface PageBody {
  items: AssignmentBody[];
  totalItems: number;
}
interface MineBody {
  schoolYear: string;
  grades: {
    grade: { id: string };
    isHomeroomTeacher: boolean;
    groups: { id: string; name: string; isHomeroomTeacher: boolean }[];
    areas: { id: string; name: string }[];
  }[];
}

const unique = () => randomUUID().slice(0, 8);

// Único archivo que cambia el año vigente (es global): los demás no dependen de él.
describe('años lectivos, asignaciones docentes y mis asignaciones', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Cookies;
  let adminId: string;
  let coordinator: Cookies;
  let coordinatorId: string;
  let teacherUser: TestUser;
  let teacher: Cookies;
  let releaseSchoolYear: () => Promise<void>;

  beforeAll(async () => {
    // Exclusivo: las pruebas de planeación necesitan un año vigente estable y no corren a la vez.
    releaseSchoolYear = await holdSchoolYearLock('exclusive');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    await prisma.schoolYear.updateMany({ data: { isCurrent: null } });
    const adminUser = await createTestUser(app, { role: UserRole.Administrator });
    adminId = adminUser.id;
    admin = await signIn(app, adminUser);
    const coordinatorUser = await createTestUser(app, { role: UserRole.Coordinator });
    coordinatorId = coordinatorUser.id;
    coordinator = await signIn(app, coordinatorUser);
    teacherUser = await createTestUser(app);
    teacher = await signIn(app, teacherUser);
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await releaseSchoolYear();
  });

  type Method = 'get' | 'post' | 'put' | 'patch';
  const as = (cookies: Cookies, method: Method, path: string) =>
    asUser(app, method, path, cookies, 'access');

  /** Grado nuevo cuya coordinadora es `coordinator` (asigna solo en los grupos de sus grados, #115). */
  async function createGradeAndArea(coordinatorOf: string | null = coordinatorId) {
    const level = await prisma.educationLevel.create({
      data: { name: `Nivel ${unique()}`, sortOrder: 1 },
    });
    const grade = await prisma.grade.create({
      data: {
        name: `Grado ${unique()}`,
        levelId: level.id,
        sortOrder: 1,
        coordinatorId: coordinatorOf,
      },
    });
    const group = await prisma.group.create({
      data: { gradeId: grade.id, name: `Grupo ${unique()}` },
    });
    const area = await newArea(level);
    return { level, grade, group, area };
  }

  /** Área activa del nivel indicado (las asignaciones exigen que el área sea del nivel del grupo). */
  async function newArea(level: { id: string }, name = `Área ${unique()}`) {
    return prisma.area.create({
      data: { name, type: 'asignatura', areaLevels: { create: [{ levelId: level.id }] } },
    });
  }

  async function yearWithPeriods(code: string, periods = 3) {
    const res = await as(admin, 'post', '/school-years').send({ code }).expect(201);
    for (let number = 1; number <= periods; number += 1) {
      await prisma.academicPeriod.create({ data: { schoolYear: code, number } });
    }
    return res.body as YearBody;
  }

  const auditRows = (entityId: string) =>
    prisma.auditLog.findMany({ where: { entityId }, orderBy: { id: 'asc' } });

  describe('sin año vigente (R15)', () => {
    it('responde 409 conflicto en mis asignaciones, el año vigente y el alta o listado sin año', async () => {
      const { group, area } = await createGradeAndArea();
      const paths: [Method, string, Cookies, object?][] = [
        ['get', '/me/assignments', teacher],
        ['get', '/school-years/current', teacher],
        ['get', '/teacher-assignments', coordinator],
        [
          'post',
          '/teacher-assignments',
          coordinator,
          { teacherId: teacherUser.id, groupId: group.id, areaId: area.id },
        ],
      ];

      for (const [method, path, cookies, body] of paths) {
        const res = await as(cookies, method, path).send(body);
        expect([path, res.status]).toEqual([path, 409]);
        const parsed = apiErrorBodySchema.parse(res.body);
        expect(parsed.code).toBe('conflicto');
        expect(parsed.message).toContain('año lectivo vigente');
      }
    });
  });

  describe('años lectivos (R19 a R21)', () => {
    it('registra un año no vigente, lo lista y rechaza el repetido y el mal formado', async () => {
      const created = await as(admin, 'post', '/school-years')
        .send({ code: '3201-3202' })
        .expect(201);
      expect(created.body).toMatchObject({ code: '3201-3202', isCurrent: false });

      await as(admin, 'post', '/school-years').send({ code: '3201-3202' }).expect(409);
      await as(admin, 'post', '/school-years').send({ code: '3201-3203' }).expect(400);
      await as(admin, 'post', '/school-years').send({ code: '3201' }).expect(400);

      const list = await as(teacher, 'get', '/school-years?pageSize=100&isCurrent=false').expect(
        200,
      );
      expect((list.body as { items: YearBody[] }).items.some((y) => y.code === '3201-3202')).toBe(
        true,
      );
    });

    it('marca el vigente solo con sus 3 periodos, deja uno solo y es idempotente', async () => {
      const incomplete = await yearWithPeriods('3211-3212', 2);
      const first = await yearWithPeriods('3213-3214');
      const second = await yearWithPeriods('3215-3216');

      const rejected = await as(admin, 'put', `/school-years/${incomplete.id}/current`).expect(409);
      expect(apiErrorBodySchema.parse(rejected.body).code).toBe('conflicto');
      await as(admin, 'put', `/school-years/${randomUUID()}/current`).expect(404);

      await as(admin, 'put', `/school-years/${first.id}/current`).expect(200);
      await as(admin, 'put', `/school-years/${first.id}/current`).expect(200);
      const current = await as(teacher, 'get', '/school-years/current').expect(200);
      expect(current.body).toMatchObject({ code: '3213-3214', isCurrent: true });

      await as(admin, 'put', `/school-years/${second.id}/current`).expect(200);
      expect(await prisma.schoolYear.count({ where: { isCurrent: true } })).toBe(1);
      expect(
        (await prisma.schoolYear.findUniqueOrThrow({ where: { id: first.id } })).isCurrent,
      ).toBeNull();
      expect(
        (await as(teacher, 'get', '/school-years/current').expect(200)).body as YearBody,
      ).toMatchObject({ code: '3215-3216' });

      const rows = await auditRows(second.id);
      expect(rows.map((row) => row.action)).toEqual([
        'Registrar año lectivo',
        'Marcar año lectivo vigente',
      ]);
      expect(rows[1]).toMatchObject({ entity: 'anio_lectivo', userId: adminId });
      expect(rows[1]?.dataBefore).toMatchObject({ isCurrent: false });
      expect(rows[1]?.dataAfter).toMatchObject({ isCurrent: true });
    });
  });

  describe('asignaciones (con año vigente)', () => {
    let currentCode: string;

    beforeAll(async () => {
      const year = await yearWithPeriods('3301-3302');
      await as(admin, 'put', `/school-years/${year.id}/current`).expect(200);
      currentCode = year.code;
    });

    const body = (teacherId: string, groupId: string, areaId: string, extra: object = {}) => ({
      teacherId,
      groupId,
      areaId,
      ...extra,
    });

    it('crea activa con el año vigente y devuelve docente, grado, nivel y área sin correo (R7)', async () => {
      const { grade, group, area, level } = await createGradeAndArea();

      const res = await as(coordinator, 'post', '/teacher-assignments')
        .send(body(teacherUser.id, group.id, area.id))
        .expect(201);
      const created = res.body as AssignmentBody;

      expect(created).toMatchObject({
        schoolYear: currentCode,
        status: 'activa',
        isHomeroomTeacher: false,
        group: { id: group.id, name: group.name },
        grade: { id: grade.id, name: grade.name },
        level: { id: level.id, name: level.name },
        area: { id: area.id, name: area.name },
      });
      expect(created.teacher).toEqual({
        id: teacherUser.id,
        fullName: expect.any(String) as unknown,
        status: 'activo',
      });
      expect(JSON.stringify(created)).not.toContain('@');

      const rows = await auditRows(created.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: 'coordinacion',
        entity: 'asignacion_docente',
        dataBefore: null,
      });
      expect(rows[0]?.dataAfter).toMatchObject({ status: 'activa', schoolYear: currentCode });
    });

    it('un administrador también puede crear; un docente recibe 403 en todas las rutas (R13)', async () => {
      const { group, area, level } = await createGradeAndArea();
      const target = (
        await as(admin, 'post', '/teacher-assignments')
          .send(body(teacherUser.id, group.id, area.id))
          .expect(201)
      ).body as AssignmentBody;

      const responses = await Promise.all([
        as(teacher, 'get', '/teacher-assignments'),
        as(teacher, 'post', '/teacher-assignments').send(
          body(teacherUser.id, group.id, (await newArea(level)).id),
        ),
        as(teacher, 'patch', `/teacher-assignments/${target.id}`).send({ isHomeroomTeacher: true }),
        as(teacher, 'patch', `/teacher-assignments/${target.id}/status`).send({
          status: 'retirada',
        }),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(403);
        expect(apiErrorBodySchema.parse(res.body).code).toBe('sin_permiso');
      }
      expect(
        (await prisma.teacherAssignment.findUniqueOrThrow({ where: { id: target.id } })).status,
      ).toBe('activa');
    });

    it('rechaza con 409 el duplicado y avisa si la existente está retirada (R8)', async () => {
      const { group, area } = await createGradeAndArea();
      const created = (
        await as(coordinator, 'post', '/teacher-assignments')
          .send(body(teacherUser.id, group.id, area.id))
          .expect(201)
      ).body as AssignmentBody;

      const active = await as(coordinator, 'post', '/teacher-assignments')
        .send(body(teacherUser.id, group.id, area.id))
        .expect(409);
      expect(apiErrorBodySchema.parse(active.body).code).toBe('conflicto');

      await as(coordinator, 'patch', `/teacher-assignments/${created.id}/status`)
        .send({ status: 'retirada' })
        .expect(200);
      const withdrawn = await as(coordinator, 'post', '/teacher-assignments')
        .send(body(teacherUser.id, group.id, area.id))
        .expect(409);
      expect(apiErrorBodySchema.parse(withdrawn.body).message).toContain('retirada');
      expect(
        await prisma.teacherAssignment.count({
          where: { teacherId: teacherUser.id, groupId: group.id, areaId: area.id },
        }),
      ).toBe(1);
    });

    it('responde 400 señalando el campo con docente inactivo o administrador, grado, área o año inválidos (R9)', async () => {
      const { group, area } = await createGradeAndArea();
      const inactive = await createTestUser(app, { status: UserStatus.Inactive });
      const adminTarget = await createTestUser(app, { role: UserRole.Administrator });
      const cases: [object, string][] = [
        [body(inactive.id, group.id, area.id), 'teacherId'],
        [body(adminTarget.id, group.id, area.id), 'teacherId'],
        [body(randomUUID(), group.id, area.id), 'teacherId'],
        [body(teacherUser.id, randomUUID(), area.id), 'groupId'],
        [body(teacherUser.id, group.id, randomUUID()), 'areaId'],
        [body(teacherUser.id, group.id, area.id, { schoolYear: '1990-1991' }), 'schoolYear'],
      ];

      for (const [payload, field] of cases) {
        const res = await as(coordinator, 'post', '/teacher-assignments').send(payload).expect(400);
        expect(apiErrorBodySchema.parse(res.body).errors?.[0]?.field).toBe(field);
      }
      expect(await prisma.teacherAssignment.count({ where: { groupId: group.id } })).toBe(0);
    });

    it('rechaza con 400 un grupo o grado inactivo, un área inactiva o de otro nivel (R9)', async () => {
      const { grade, group, area, level } = await createGradeAndArea();
      const otherLevel = await prisma.educationLevel.create({
        data: { name: `Nivel ${unique()}`, sortOrder: 2 },
      });
      const foreign = await newArea(otherLevel);
      const inactiveArea = await newArea(level);
      await prisma.area.update({ where: { id: inactiveArea.id }, data: { active: false } });
      const dormantGroup = await prisma.group.create({
        data: { gradeId: grade.id, name: `Dormido ${unique()}`, active: false },
      });
      const cases: [object, string, RegExp][] = [
        [body(teacherUser.id, dormantGroup.id, area.id), 'groupId', /grupo está inactivo/],
        [body(teacherUser.id, group.id, inactiveArea.id), 'areaId', /área está inactiva/],
        [body(teacherUser.id, group.id, foreign.id), 'areaId', /no pertenece al nivel/],
      ];

      for (const [payload, field, reason] of cases) {
        const res = await as(coordinator, 'post', '/teacher-assignments').send(payload).expect(400);
        const first = apiErrorBodySchema.parse(res.body).errors?.[0];
        expect([first?.field, first?.reason]).toEqual([field, expect.stringMatching(reason)]);
      }

      await prisma.grade.update({ where: { id: grade.id }, data: { active: false } });
      const res = await as(coordinator, 'post', '/teacher-assignments')
        .send(body(teacherUser.id, group.id, area.id))
        .expect(400);
      expect(apiErrorBodySchema.parse(res.body).errors?.[0]?.reason).toMatch(/grado está inactivo/);
      expect(
        await prisma.teacherAssignment.count({ where: { group: { gradeId: grade.id } } }),
      ).toBe(0);
    });

    it('un coordinador es asignable y se puede usar un año registrado distinto del vigente', async () => {
      const { group, area } = await createGradeAndArea();
      const next = await yearWithPeriods('3303-3304');
      const coordinatorUser = await createTestUser(app, { role: UserRole.Coordinator });

      const res = await as(coordinator, 'post', '/teacher-assignments')
        .send(body(coordinatorUser.id, group.id, area.id, { schoolYear: next.code }))
        .expect(201);

      expect(res.body).toMatchObject({ schoolYear: next.code });
    });

    it('retira y reactiva sin borrar, y la reactivación repite las validaciones (R10)', async () => {
      const { group, area } = await createGradeAndArea();
      const user = await createTestUser(app);
      const created = (
        await as(coordinator, 'post', '/teacher-assignments')
          .send(body(user.id, group.id, area.id))
          .expect(201)
      ).body as AssignmentBody;
      const statusPath = `/teacher-assignments/${created.id}/status`;

      const withdrawn = await as(coordinator, 'patch', statusPath)
        .send({ status: 'retirada' })
        .expect(200);
      expect(withdrawn.body).toMatchObject({ id: created.id, status: 'retirada' });
      expect(await prisma.teacherAssignment.count({ where: { id: created.id } })).toBe(1);
      await as(coordinator, 'patch', statusPath).send({ status: 'retirada' }).expect(200);

      await prisma.user.update({ where: { id: user.id }, data: { status: 'inactivo' } });
      await as(coordinator, 'patch', statusPath).send({ status: 'activa' }).expect(400);
      await prisma.user.update({ where: { id: user.id }, data: { status: 'activo' } });
      const reactivated = await as(coordinator, 'patch', statusPath)
        .send({ status: 'activa' })
        .expect(200);
      expect(reactivated.body).toMatchObject({ status: 'activa' });

      const rows = await auditRows(created.id);
      expect(rows.map((row) => row.action)).toContain(
        'Cambiar el estado de una asignación docente',
      );
      const retire = rows.find(
        (row) => (row.dataAfter as { status?: string } | null)?.status === 'retirada',
      );
      expect(retire?.dataBefore).toMatchObject({ status: 'activa' });
      await as(coordinator, 'patch', `/teacher-assignments/${randomUUID()}/status`)
        .send({ status: 'retirada' })
        .expect(404);
      await as(coordinator, 'patch', statusPath).send({ status: 'otra' }).expect(400);
    });

    it('permite un solo director de grupo por grupo y año; la marca se repite en otra fila solo si el grupo no la tiene (R10)', async () => {
      const { group, area, level } = await createGradeAndArea();
      const secondArea = await newArea(level);
      const other = await createTestUser(app);
      const first = (
        await as(coordinator, 'post', '/teacher-assignments')
          .send(body(teacherUser.id, group.id, area.id, { isHomeroomTeacher: true }))
          .expect(201)
      ).body as AssignmentBody;

      // Una segunda fila marcada del mismo docente en el mismo grupo también da 409.
      const sameTeacher = await as(coordinator, 'post', '/teacher-assignments')
        .send(body(teacherUser.id, group.id, secondArea.id, { isHomeroomTeacher: true }))
        .expect(409);
      expect(apiErrorBodySchema.parse(sameTeacher.body).message).toMatch(
        new RegExp(`${group.name} ya tiene director\\(a\\) de grupo`),
      );
      const conflict = await as(coordinator, 'post', '/teacher-assignments')
        .send(body(other.id, group.id, area.id, { isHomeroomTeacher: true }))
        .expect(409);
      expect(apiErrorBodySchema.parse(conflict.body).code).toBe('conflicto');
      expect(await prisma.teacherAssignment.count({ where: { teacherId: other.id } })).toBe(0);

      const plain = (
        await as(coordinator, 'post', '/teacher-assignments')
          .send(body(other.id, group.id, area.id))
          .expect(201)
      ).body as AssignmentBody;
      await as(coordinator, 'patch', `/teacher-assignments/${plain.id}`)
        .send({ isHomeroomTeacher: true })
        .expect(409);

      // Retirar al director libera la dirección; reactivarlo con otro director vigente falla.
      await as(coordinator, 'patch', `/teacher-assignments/${first.id}/status`)
        .send({ status: 'retirada' })
        .expect(200);
      expect(
        (await prisma.teacherAssignment.findUniqueOrThrow({ where: { id: first.id } }))
          .isHomeroomTeacher,
      ).toBe(false);
      await as(coordinator, 'patch', `/teacher-assignments/${plain.id}`)
        .send({ isHomeroomTeacher: true })
        .expect(200);
      await as(coordinator, 'patch', `/teacher-assignments/${first.id}/status`)
        .send({ status: 'activa' })
        .expect(200);
      expect(
        (await prisma.teacherAssignment.findUniqueOrThrow({ where: { id: first.id } })).status,
      ).toBe('activa');
    });

    it('dos grupos del mismo grado pueden tener cada uno su director(a)', async () => {
      const { grade, group, area } = await createGradeAndArea();
      const second = await prisma.group.create({
        data: { gradeId: grade.id, name: `Grupo ${unique()}` },
      });
      const other = await createTestUser(app);

      await as(coordinator, 'post', '/teacher-assignments')
        .send(body(teacherUser.id, group.id, area.id, { isHomeroomTeacher: true }))
        .expect(201);
      await as(coordinator, 'post', '/teacher-assignments')
        .send(body(other.id, second.id, area.id, { isHomeroomTeacher: true }))
        .expect(201);
    });

    it('dos altas simultáneas de director en el mismo grupo: una gana y la otra recibe 409 (R10)', async () => {
      const { group, area } = await createGradeAndArea();
      const [one, two] = [await createTestUser(app), await createTestUser(app)];

      const results = await Promise.all(
        [one, two].map((user) =>
          as(coordinator, 'post', '/teacher-assignments').send(
            body(user.id, group.id, area.id, { isHomeroomTeacher: true }),
          ),
        ),
      );

      expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
      expect(
        await prisma.teacherAssignment.count({
          where: { groupId: group.id, isHomeroomTeacher: true, status: 'activa' },
        }),
      ).toBe(1);
    });

    it('al retirar la fila que dirige el grupo, la marca pasa a otra fila activa del mismo docente o el grupo queda sin director (R11)', async () => {
      const { group, area, level } = await createGradeAndArea();
      const secondArea = await newArea(level);
      const [first, second] = [
        (
          await as(coordinator, 'post', '/teacher-assignments')
            .send(body(teacherUser.id, group.id, area.id, { isHomeroomTeacher: true }))
            .expect(201)
        ).body as AssignmentBody,
        (
          await as(coordinator, 'post', '/teacher-assignments')
            .send(body(teacherUser.id, group.id, secondArea.id))
            .expect(201)
        ).body as AssignmentBody,
      ];

      await as(coordinator, 'patch', `/teacher-assignments/${first.id}/status`)
        .send({ status: 'retirada' })
        .expect(200);

      const afterFirst = await prisma.teacherAssignment.findMany({
        where: { groupId: group.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(afterFirst.map((row) => [row.id, row.status, row.isHomeroomTeacher])).toEqual([
        [first.id, 'retirada', false],
        [second.id, 'activa', true],
      ]);

      await as(coordinator, 'patch', `/teacher-assignments/${second.id}/status`)
        .send({ status: 'retirada' })
        .expect(200);
      expect(
        await prisma.teacherAssignment.count({
          where: { groupId: group.id, isHomeroomTeacher: true },
        }),
      ).toBe(0);
    });

    it('lista paginado con filtros y por defecto el año vigente (R11)', async () => {
      const { grade, group, area, level } = await createGradeAndArea();
      const user = await createTestUser(app);
      const next = await yearWithPeriods('3305-3306');
      const inCurrent = (
        await as(coordinator, 'post', '/teacher-assignments')
          .send(body(user.id, group.id, area.id))
          .expect(201)
      ).body as AssignmentBody;
      const second = await newArea(level);
      const inNext = (
        await as(coordinator, 'post', '/teacher-assignments')
          .send(body(user.id, group.id, second.id, { schoolYear: next.code }))
          .expect(201)
      ).body as AssignmentBody;
      await as(coordinator, 'patch', `/teacher-assignments/${inCurrent.id}/status`)
        .send({ status: 'retirada' })
        .expect(200);

      const byDefault = await as(
        coordinator,
        'get',
        `/teacher-assignments?teacherId=${user.id}`,
      ).expect(200);
      expect((byDefault.body as PageBody).items.map((a) => a.id)).toEqual([inCurrent.id]);

      const explicit = await as(
        coordinator,
        'get',
        `/teacher-assignments?teacherId=${user.id}&schoolYear=${next.code}`,
      ).expect(200);
      expect((explicit.body as PageBody).items.map((a) => a.id)).toEqual([inNext.id]);

      const byStatus = await as(
        coordinator,
        'get',
        `/teacher-assignments?teacherId=${user.id}&status=activa`,
      ).expect(200);
      expect((byStatus.body as PageBody).totalItems).toBe(0);
      const byArea = await as(
        coordinator,
        'get',
        `/teacher-assignments?teacherId=${user.id}&areaId=${area.id}&gradeId=${grade.id}&status=retirada`,
      ).expect(200);
      expect((byArea.body as PageBody).items.map((a) => a.id)).toEqual([inCurrent.id]);
      const byGroup = await as(
        coordinator,
        'get',
        `/teacher-assignments?teacherId=${user.id}&groupId=${group.id}&status=retirada`,
      ).expect(200);
      expect((byGroup.body as PageBody).items.map((a) => a.id)).toEqual([inCurrent.id]);
      await as(coordinator, 'get', '/teacher-assignments?pageSize=1').expect(200);
      await as(coordinator, 'get', '/teacher-assignments?status=otra').expect(400);
    });

    it('mis asignaciones agrupa por grado, con sus grupos, y muestra una sola vez el área repetida en varios grupos (R14, R15)', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);
      const { grade, group, area, level } = await createGradeAndArea();
      const secondGroup = await prisma.group.create({
        data: { gradeId: grade.id, name: `Grupo ${unique()}` },
      });
      const second = await newArea(level, 'Zoología ' + unique());
      const third = await newArea(level, 'Álgebra ' + unique());
      const retired = await newArea(level);
      const otherYear = await newArea(level);
      const next = await yearWithPeriods('3307-3308');
      const create = async (groupId: string, areaId: string, extra: object = {}) =>
        (
          await as(coordinator, 'post', '/teacher-assignments')
            .send(body(user.id, groupId, areaId, extra))
            .expect(201)
        ).body as AssignmentBody;
      await create(group.id, second.id);
      await create(group.id, third.id, { isHomeroomTeacher: true });
      await create(group.id, area.id);
      // La misma área en otro grupo del grado no se repite.
      await create(secondGroup.id, area.id);
      const gone = await create(group.id, retired.id);
      await create(group.id, otherYear.id, { schoolYear: next.code });
      await as(coordinator, 'patch', `/teacher-assignments/${gone.id}/status`)
        .send({ status: 'retirada' })
        .expect(200);

      const res = await as(cookies, 'get', '/me/assignments').expect(200);
      const mine = res.body as MineBody;

      expect(mine.schoolYear).toBe(currentCode);
      expect(mine.grades).toHaveLength(1);
      expect(mine.grades[0]).toMatchObject({ grade: { id: grade.id }, isHomeroomTeacher: true });
      const names = mine.grades[0]?.areas.map((a) => a.name) ?? [];
      expect(names).toHaveLength(3);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
      expect(names).not.toContain(retired.name);
      expect(names).not.toContain(otherYear.name);
      expect(mine.grades[0]?.groups.map((g) => [g.id, g.isHomeroomTeacher]).sort()).toEqual(
        [
          [group.id, true],
          [secondGroup.id, false],
        ].sort(),
      );
      expect(JSON.stringify(mine)).not.toContain('assignmentId');
    });

    it('sin asignaciones devuelve la lista vacía; solo es del docente (administración, 403)', async () => {
      const empty = await signIn(app, await createTestUser(app));
      const res = await as(empty, 'get', '/me/assignments').expect(200);

      expect(res.body).toEqual({ schoolYear: currentCode, grades: [] });
      await as(admin, 'get', '/me/assignments').expect(403);
      await as(coordinator, 'get', '/me/assignments').expect(403);
    });

    it('la coordinadora asigna, edita y retira solo en los grupos de sus grados (403 en otro caso); administración, en cualquiera (Q3)', async () => {
      const own = await createGradeAndArea();
      const foreign = await createGradeAndArea(null);
      const created = (
        await as(coordinator, 'post', '/teacher-assignments')
          .send(body(teacherUser.id, own.group.id, own.area.id))
          .expect(201)
      ).body as AssignmentBody;

      const outside = await as(coordinator, 'post', '/teacher-assignments')
        .send(body(teacherUser.id, foreign.group.id, foreign.area.id))
        .expect(403);
      expect(apiErrorBodySchema.parse(outside.body).code).toBe('sin_permiso');
      const adminCreated = (
        await as(admin, 'post', '/teacher-assignments')
          .send(body(teacherUser.id, foreign.group.id, foreign.area.id))
          .expect(201)
      ).body as AssignmentBody;
      // Editar y retirar una asignación de otro grado: 403 sin cambiarla.
      await as(coordinator, 'patch', `/teacher-assignments/${adminCreated.id}`)
        .send({ isHomeroomTeacher: true })
        .expect(403);
      await as(coordinator, 'patch', `/teacher-assignments/${adminCreated.id}/status`)
        .send({ status: 'retirada' })
        .expect(403);
      expect(
        await prisma.teacherAssignment.findUniqueOrThrow({ where: { id: adminCreated.id } }),
      ).toMatchObject({ status: 'activa', isHomeroomTeacher: false });
      // En su grado sí; el listado es de todo el colegio para ambos roles.
      await as(coordinator, 'patch', `/teacher-assignments/${created.id}/status`)
        .send({ status: 'retirada' })
        .expect(200);
      await as(admin, 'patch', `/teacher-assignments/${adminCreated.id}/status`)
        .send({ status: 'retirada' })
        .expect(200);
      const listed = (await as(coordinator, 'get', '/teacher-assignments?pageSize=100').expect(200))
        .body as PageBody;
      expect(listed.items.map((item) => item.id)).toContain(adminCreated.id);
    });

    it('no deja fila de bitácora si la escritura falla (R16)', async () => {
      const { group, area } = await createGradeAndArea();
      const before = await prisma.auditLog.count({ where: { entity: 'asignacion_docente' } });

      await as(coordinator, 'post', '/teacher-assignments')
        .send(body(randomUUID(), group.id, area.id))
        .expect(400);
      await as(coordinator, 'post', '/teacher-assignments')
        .send(body(teacherUser.id, group.id, area.id, { schoolYear: '1990-1991' }))
        .expect(400);
      await as(coordinator, 'patch', `/teacher-assignments/${randomUUID()}`)
        .send({ isHomeroomTeacher: true })
        .expect(404);

      expect(await prisma.auditLog.count({ where: { entity: 'asignacion_docente' } })).toBe(before);
    });
  });
});
