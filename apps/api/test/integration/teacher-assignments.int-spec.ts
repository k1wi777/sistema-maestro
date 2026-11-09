import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, UserRole, UserStatus } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
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
    areas: { assignmentId: string; name: string }[];
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
  let teacherUser: TestUser;
  let teacher: Cookies;

  beforeAll(async () => {
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    await prisma.schoolYear.updateMany({ data: { isCurrent: null } });
    const adminUser = await createTestUser(app, { role: UserRole.Administrator });
    adminId = adminUser.id;
    admin = await signIn(app, adminUser);
    coordinator = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
    teacherUser = await createTestUser(app);
    teacher = await signIn(app, teacherUser);
  });

  afterAll(async () => {
    await app.close();
  });

  type Method = 'get' | 'post' | 'put' | 'patch';
  const as = (cookies: Cookies, method: Method, path: string) =>
    asUser(app, method, path, cookies, 'access');

  async function createGradeAndArea() {
    const level = await prisma.educationLevel.create({
      data: { name: `Nivel ${unique()}`, sortOrder: 1 },
    });
    const grade = await prisma.grade.create({
      data: { name: `Grado ${unique()}`, levelId: level.id, sortOrder: 1 },
    });
    const area = await prisma.area.create({
      data: { name: `Área ${unique()}`, type: 'asignatura' },
    });
    return { level, grade, area };
  }

  async function newArea(name = `Área ${unique()}`) {
    return prisma.area.create({ data: { name, type: 'asignatura' } });
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
      const { grade, area } = await createGradeAndArea();
      const paths: [Method, string, Cookies, object?][] = [
        ['get', '/me/assignments', teacher],
        ['get', '/school-years/current', teacher],
        ['get', '/teacher-assignments', coordinator],
        [
          'post',
          '/teacher-assignments',
          coordinator,
          { teacherId: teacherUser.id, gradeId: grade.id, areaId: area.id },
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

    it('docente y coordinador reciben 403 al registrar o marcar un año', async () => {
      const year = await yearWithPeriods('3221-3222');
      for (const cookies of [teacher, coordinator]) {
        await as(cookies, 'post', '/school-years').send({ code: '3223-3224' }).expect(403);
        await as(cookies, 'put', `/school-years/${year.id}/current`).expect(403);
      }
      expect(await prisma.schoolYear.count({ where: { code: '3223-3224' } })).toBe(0);
    });
  });

  describe('asignaciones (con año vigente)', () => {
    let currentCode: string;

    beforeAll(async () => {
      const year = await yearWithPeriods('3301-3302');
      await as(admin, 'put', `/school-years/${year.id}/current`).expect(200);
      currentCode = year.code;
    });

    const body = (teacherId: string, gradeId: string, areaId: string, extra: object = {}) => ({
      teacherId,
      gradeId,
      areaId,
      ...extra,
    });

    it('crea activa con el año vigente y devuelve docente, grado, nivel y área sin correo (R7)', async () => {
      const { grade, area, level } = await createGradeAndArea();

      const res = await as(coordinator, 'post', '/teacher-assignments')
        .send(body(teacherUser.id, grade.id, area.id))
        .expect(201);
      const created = res.body as AssignmentBody;

      expect(created).toMatchObject({
        schoolYear: currentCode,
        status: 'activa',
        isHomeroomTeacher: false,
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
      const { grade, area } = await createGradeAndArea();
      const target = (
        await as(admin, 'post', '/teacher-assignments')
          .send(body(teacherUser.id, grade.id, area.id))
          .expect(201)
      ).body as AssignmentBody;

      const responses = await Promise.all([
        as(teacher, 'get', '/teacher-assignments'),
        as(teacher, 'post', '/teacher-assignments').send(
          body(teacherUser.id, grade.id, (await newArea()).id),
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
      const { grade, area } = await createGradeAndArea();
      const created = (
        await as(coordinator, 'post', '/teacher-assignments')
          .send(body(teacherUser.id, grade.id, area.id))
          .expect(201)
      ).body as AssignmentBody;

      const active = await as(coordinator, 'post', '/teacher-assignments')
        .send(body(teacherUser.id, grade.id, area.id))
        .expect(409);
      expect(apiErrorBodySchema.parse(active.body).code).toBe('conflicto');

      await as(coordinator, 'patch', `/teacher-assignments/${created.id}/status`)
        .send({ status: 'retirada' })
        .expect(200);
      const withdrawn = await as(coordinator, 'post', '/teacher-assignments')
        .send(body(teacherUser.id, grade.id, area.id))
        .expect(409);
      expect(apiErrorBodySchema.parse(withdrawn.body).message).toContain('retirada');
      expect(
        await prisma.teacherAssignment.count({
          where: { teacherId: teacherUser.id, gradeId: grade.id, areaId: area.id },
        }),
      ).toBe(1);
    });

    it('responde 400 señalando el campo con docente inactivo o administrador, grado, área o año inválidos (R9)', async () => {
      const { grade, area } = await createGradeAndArea();
      const inactive = await createTestUser(app, { status: UserStatus.Inactive });
      const adminTarget = await createTestUser(app, { role: UserRole.Administrator });
      const cases: [object, string][] = [
        [body(inactive.id, grade.id, area.id), 'teacherId'],
        [body(adminTarget.id, grade.id, area.id), 'teacherId'],
        [body(randomUUID(), grade.id, area.id), 'teacherId'],
        [body(teacherUser.id, randomUUID(), area.id), 'gradeId'],
        [body(teacherUser.id, grade.id, randomUUID()), 'areaId'],
        [body(teacherUser.id, grade.id, area.id, { schoolYear: '1990-1991' }), 'schoolYear'],
      ];

      for (const [payload, field] of cases) {
        const res = await as(coordinator, 'post', '/teacher-assignments').send(payload).expect(400);
        expect(apiErrorBodySchema.parse(res.body).errors?.[0]?.field).toBe(field);
      }
      expect(await prisma.teacherAssignment.count({ where: { gradeId: grade.id } })).toBe(0);
    });

    it('un coordinador es asignable y se puede usar un año registrado distinto del vigente', async () => {
      const { grade, area } = await createGradeAndArea();
      const next = await yearWithPeriods('3303-3304');
      const coordinatorUser = await createTestUser(app, { role: UserRole.Coordinator });

      const res = await as(coordinator, 'post', '/teacher-assignments')
        .send(body(coordinatorUser.id, grade.id, area.id, { schoolYear: next.code }))
        .expect(201);

      expect(res.body).toMatchObject({ schoolYear: next.code });
    });

    it('retira y reactiva sin borrar, y la reactivación repite las validaciones (R10)', async () => {
      const { grade, area } = await createGradeAndArea();
      const user = await createTestUser(app);
      const created = (
        await as(coordinator, 'post', '/teacher-assignments')
          .send(body(user.id, grade.id, area.id))
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

    it('permite un solo director de grupo por grado y año, con varias áreas del mismo docente (R12)', async () => {
      const { grade, area } = await createGradeAndArea();
      const secondArea = await newArea();
      const other = await createTestUser(app);
      const first = (
        await as(coordinator, 'post', '/teacher-assignments')
          .send(body(teacherUser.id, grade.id, area.id, { isHomeroomTeacher: true }))
          .expect(201)
      ).body as AssignmentBody;
      const sibling = (
        await as(coordinator, 'post', '/teacher-assignments')
          .send(body(teacherUser.id, grade.id, secondArea.id, { isHomeroomTeacher: true }))
          .expect(201)
      ).body as AssignmentBody;

      const conflict = await as(coordinator, 'post', '/teacher-assignments')
        .send(body(other.id, grade.id, area.id, { isHomeroomTeacher: true }))
        .expect(409);
      expect(apiErrorBodySchema.parse(conflict.body).code).toBe('conflicto');
      expect(await prisma.teacherAssignment.count({ where: { teacherId: other.id } })).toBe(0);

      const plain = (
        await as(coordinator, 'post', '/teacher-assignments')
          .send(body(other.id, grade.id, area.id))
          .expect(201)
      ).body as AssignmentBody;
      await as(coordinator, 'patch', `/teacher-assignments/${plain.id}`)
        .send({ isHomeroomTeacher: true })
        .expect(409);

      // Retirar al director libera la dirección; reactivarlo con otro director vigente falla.
      await as(coordinator, 'patch', `/teacher-assignments/${sibling.id}/status`)
        .send({ status: 'retirada' })
        .expect(200);
      await as(coordinator, 'patch', `/teacher-assignments/${first.id}/status`)
        .send({ status: 'retirada' })
        .expect(200);
      await as(coordinator, 'patch', `/teacher-assignments/${plain.id}`)
        .send({ isHomeroomTeacher: true })
        .expect(200);
      await as(coordinator, 'patch', `/teacher-assignments/${first.id}/status`)
        .send({ status: 'activa' })
        .expect(409);
      expect(
        (await prisma.teacherAssignment.findUniqueOrThrow({ where: { id: first.id } })).status,
      ).toBe('retirada');
    });

    it('lista paginado con filtros y por defecto el año vigente (R11)', async () => {
      const { grade, area } = await createGradeAndArea();
      const user = await createTestUser(app);
      const next = await yearWithPeriods('3305-3306');
      const inCurrent = (
        await as(coordinator, 'post', '/teacher-assignments')
          .send(body(user.id, grade.id, area.id))
          .expect(201)
      ).body as AssignmentBody;
      const second = await newArea();
      const inNext = (
        await as(coordinator, 'post', '/teacher-assignments')
          .send(body(user.id, grade.id, second.id, { schoolYear: next.code }))
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
      await as(coordinator, 'get', '/teacher-assignments?pageSize=1').expect(200);
      await as(coordinator, 'get', '/teacher-assignments?status=otra').expect(400);
    });

    it('mis asignaciones agrupa por grado y excluye retiradas y otros años (R14)', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);
      const { grade, area } = await createGradeAndArea();
      const second = await newArea('Zoología ' + unique());
      const third = await newArea('Álgebra ' + unique());
      const retired = await newArea();
      const otherYear = await newArea();
      const next = await yearWithPeriods('3307-3308');
      const create = async (areaId: string, extra: object = {}) =>
        (
          await as(coordinator, 'post', '/teacher-assignments')
            .send(body(user.id, grade.id, areaId, extra))
            .expect(201)
        ).body as AssignmentBody;
      await create(second.id);
      await create(third.id, { isHomeroomTeacher: true });
      await create(area.id);
      const gone = await create(retired.id);
      await create(otherYear.id, { schoolYear: next.code });
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
    });

    it('sin asignaciones devuelve la lista vacía, también para un administrador', async () => {
      const res = await as(admin, 'get', '/me/assignments').expect(200);

      expect(res.body).toEqual({ schoolYear: currentCode, grades: [] });
    });

    it('no deja fila de bitácora si la escritura falla (R16)', async () => {
      const { grade, area } = await createGradeAndArea();
      const before = await prisma.auditLog.count({ where: { entity: 'asignacion_docente' } });

      await as(coordinator, 'post', '/teacher-assignments')
        .send(body(randomUUID(), grade.id, area.id))
        .expect(400);
      await as(coordinator, 'post', '/teacher-assignments')
        .send(body(teacherUser.id, grade.id, area.id, { schoolYear: '1990-1991' }))
        .expect(400);
      await as(coordinator, 'patch', `/teacher-assignments/${randomUUID()}`)
        .send({ isHomeroomTeacher: true })
        .expect(404);

      expect(await prisma.auditLog.count({ where: { entity: 'asignacion_docente' } })).toBe(before);
    });
  });
});
