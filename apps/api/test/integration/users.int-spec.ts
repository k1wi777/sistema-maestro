import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, UserRole, UserStatus, type User } from '@gns/shared';
import { TeacherAssignmentsService } from '../../src/modules/estructura/assignments/teacher-assignments.service';
import { USER_REPOSITORY } from '../../src/modules/identidad/users/user.repository';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { createNote } from './support/formats';
import {
  asUser,
  createTestUser,
  login,
  randomPassword,
  signIn,
  type Cookies,
  type TestUser,
} from './support/session';

type UserBody = Omit<User, 'createdAt'> & { createdAt: string };

describe('gestión de usuarios', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let adminCookies: Cookies;

  beforeAll(async () => {
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    admin = await createTestUser(app, { role: UserRole.Administrator });
    adminCookies = await signIn(app, admin);
  });

  afterAll(async () => {
    await app.close();
  });

  const asAdmin = (method: 'get' | 'post' | 'put' | 'patch', path: string) =>
    asUser(app, method, path, adminCookies, 'access');

  const newUserBody = (overrides: Record<string, unknown> = {}) => ({
    fullName: 'Persona Nueva de Prueba',
    email: `${randomUUID().slice(0, 12)}@Nuevos.test`,
    role: UserRole.Teacher,
    password: randomPassword(),
    ...overrides,
  });

  async function createViaApi(overrides: Record<string, unknown> = {}) {
    const body = newUserBody(overrides);
    const res = await asAdmin('post', '/users').send(body).expect(201);
    return { body, user: res.body as UserBody };
  }

  // Los demás archivos de prueba comparten la base: se comprueba por correo, no por conteo.
  const emailExists = async (email: string) =>
    (await prisma.user.count({ where: { institutionalEmail: email.toLowerCase() } })) > 0;

  // Solo la gestión de usuarios: los ingresos de la misma cuenta también llevan su id.
  const auditRows = (entityId: string) =>
    prisma.auditLog.findMany({ where: { entityId, type: 'usuarios' }, orderBy: { id: 'asc' } });

  /** Ningún campo de la fila de bitácora puede contener la contraseña ni algo parecido a un hash. */
  function expectNoSecrets(rows: unknown[], password?: string) {
    const text = JSON.stringify(rows, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    expect(text).not.toContain('argon2');
    expect(text.toLowerCase()).not.toContain('hash');
    expect(text).not.toContain('credencial');
    if (password) {
      expect(text).not.toContain(password);
    }
  }

  describe('permisos (R6)', () => {
    it.each([UserRole.Teacher, UserRole.Coordinator])(
      'un %s recibe 403 en cada endpoint y no se modifica nada',
      async (role) => {
        const user = await createTestUser(app, { role });
        const cookies = await signIn(app, user);
        const target = await createTestUser(app);
        const attempt = newUserBody();
        const as = (method: 'get' | 'post' | 'put' | 'patch', path: string) =>
          asUser(app, method, path, cookies, 'access');

        const responses = await Promise.all([
          as('get', '/users'),
          as('get', `/users/${target.id}`),
          as('post', '/users').send(attempt),
          as('patch', `/users/${target.id}`).send({ fullName: 'Otro nombre' }),
          as('put', `/users/${target.id}/role`).send({ role: UserRole.Administrator }),
          as('patch', `/users/${target.id}/status`).send({ status: UserStatus.Inactive }),
          as('put', `/users/${target.id}/password`).send({ password: randomPassword() }),
        ]);

        for (const res of responses) {
          expect(res.status).toBe(403);
          expect(apiErrorBodySchema.parse(res.body).code).toBe('sin_permiso');
        }
        expect(await emailExists(attempt.email)).toBe(false);
        const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
        expect(unchanged).toMatchObject({ role: UserRole.Teacher, status: UserStatus.Active });
        await login(app, { email: target.email, password: target.password }).expect(200);
      },
    );

    it('un cambio de rol revoca las sesiones: la anterior ya no sirve y el nuevo ingreso lleva el rol nuevo', async () => {
      const other = await createTestUser(app, { role: UserRole.Administrator });
      const cookies = await signIn(app, other);
      await asUser(app, 'get', '/users', cookies, 'access').expect(200);

      await asAdmin('put', `/users/${other.id}/role`).send({ role: UserRole.Teacher }).expect(200);

      await asUser(app, 'get', '/users', cookies, 'access').expect(401);
      const sessions = await prisma.session.findMany({ where: { userId: other.id } });
      expect(sessions.every((item) => item.revocationReason === 'cambio_rol')).toBe(true);
      const fresh = await signIn(app, other);
      await asUser(app, 'get', '/users', fresh, 'access').expect(403);
      await asUser(app, 'get', '/auth/me', fresh, 'access').expect(200);
    });
  });

  describe('crear (R1, R8, R9, R10, R11)', () => {
    it('crea el usuario activo con creado_por del administrador y sin credenciales en la respuesta', async () => {
      const { body, user } = await createViaApi();

      expect(user).toMatchObject({
        fullName: body.fullName,
        email: body.email.toLowerCase(),
        role: UserRole.Teacher,
        status: UserStatus.Active,
        createdById: admin.id,
      });
      expect(Object.keys(user).sort()).toEqual(
        ['createdAt', 'createdById', 'email', 'fullName', 'id', 'role', 'status'].sort(),
      );
      const stored = await prisma.passwordCredential.findUniqueOrThrow({
        where: { userId: user.id },
      });
      expect(stored.hash.startsWith('$argon2id$')).toBe(true);
      expect(stored.hash).not.toContain(body.password);
      await login(app, { email: body.email, password: body.password }).expect(200);
    });

    it('registra en la bitácora el id y el rol del administrador, sin contraseña ni hash', async () => {
      const { body, user } = await createViaApi();

      const rows = await auditRows(user.id);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: admin.id,
        role: UserRole.Administrator,
        type: 'usuarios',
        entity: 'usuario',
        action: 'Crear usuario',
        dataBefore: null,
      });
      expect(rows[0]?.dataAfter).toMatchObject({ email: body.email.toLowerCase() });
      expectNoSecrets(rows, body.password);
    });

    it('responde 409 si el correo ya existe, sin distinguir mayúsculas, y no crea nada', async () => {
      const { body } = await createViaApi();

      const res = await asAdmin('post', '/users')
        .send(newUserBody({ email: body.email.toUpperCase(), fullName: 'Duplicado' }))
        .expect(409);

      expect(apiErrorBodySchema.parse(res.body).code).toBe('conflicto');
      expect(await prisma.user.count({ where: { fullName: 'Duplicado' } })).toBe(0);
    });

    it.each([
      ['demasiado corta', 'a'.repeat(11)],
      ['demasiado larga', 'a'.repeat(129)],
    ])('rechaza con 400 una contraseña %s indicando el campo y el motivo', async (_, password) => {
      const attempt = newUserBody({ password });

      const res = await asAdmin('post', '/users').send(attempt).expect(400);

      const error = apiErrorBodySchema.parse(res.body).errors?.[0];
      expect(error?.field).toBe('password');
      expect(error?.reason).toMatch(/caracteres/);
      expect(JSON.stringify(res.body)).not.toContain(password);
      expect(await emailExists(attempt.email)).toBe(false);
    });

    it('acepta contraseñas de exactamente 12 y 128 caracteres', async () => {
      await createViaApi({ password: 'a'.repeat(12) });
      await createViaApi({ password: 'b'.repeat(128) });
    });

    it.each([
      ['un rol desconocido', { role: 'superusuario' }],
      ['un campo extra', { status: 'inactivo' }],
      ['un correo inválido', { email: 'no-es-un-correo' }],
      ['un nombre vacío', { fullName: '   ' }],
    ])('rechaza con 400 %s', async (_, overrides) => {
      await asAdmin('post', '/users').send(newUserBody(overrides)).expect(400);
    });
  });

  describe('consultar (R4)', () => {
    it('lista con paginación, filtros, búsqueda y orden, y devuelve el detalle por id', async () => {
      const tag = `Listado${randomUUID().slice(0, 8)}`;
      const a = await createViaApi({ fullName: `${tag} Ana`, role: UserRole.Teacher });
      const b = await createViaApi({ fullName: `${tag} Beto`, role: UserRole.Coordinator });
      const c = await createViaApi({ fullName: `${tag} Carla`, role: UserRole.Teacher });
      await asAdmin('patch', `/users/${c.user.id}/status`)
        .send({ status: UserStatus.Inactive })
        .expect(200);

      const all = await asAdmin('get', '/users').query({ search: tag.toLowerCase() }).expect(200);
      const names = (all.body as { items: UserBody[] }).items.map((u) => u.fullName);
      expect(names).toEqual([`${tag} Ana`, `${tag} Beto`, `${tag} Carla`]);
      expect(all.body).toMatchObject({ page: 1, pageSize: 20, totalItems: 3, totalPages: 1 });

      const page = await asAdmin('get', '/users')
        .query({ search: tag, sortBy: 'fullName', sortOrder: 'desc', pageSize: 2, page: 2 })
        .expect(200);
      expect(page.body).toMatchObject({ page: 2, pageSize: 2, totalItems: 3, totalPages: 2 });
      expect((page.body as { items: UserBody[] }).items.map((u) => u.id)).toEqual([a.user.id]);

      const teachers = await asAdmin('get', '/users')
        .query({ search: tag, role: UserRole.Teacher })
        .expect(200);
      expect((teachers.body as { items: UserBody[] }).items).toHaveLength(2);

      const inactive = await asAdmin('get', '/users')
        .query({ search: tag, status: UserStatus.Inactive })
        .expect(200);
      expect((inactive.body as { items: UserBody[] }).items.map((u) => u.id)).toEqual([c.user.id]);

      const byEmail = await asAdmin('get', '/users')
        .query({ search: tag, sortBy: 'email', sortOrder: 'asc' })
        .expect(200);
      const emails = (byEmail.body as { items: UserBody[] }).items.map((u) => u.email);
      expect(emails).toEqual([...emails].sort());

      const byDate = await asAdmin('get', '/users')
        .query({ search: tag, sortBy: 'createdAt', sortOrder: 'desc' })
        .expect(200);
      expect((byDate.body as { items: UserBody[] }).items[0]?.id).toBe(c.user.id);

      const detail = await asAdmin('get', `/users/${b.user.id}`).expect(200);
      expect(detail.body).toEqual(b.user);
    });

    it('responde 404 para un id inexistente y 400 para uno que no es UUID; rechaza orden inválido', async () => {
      await asAdmin('get', `/users/${randomUUID()}`).expect(404);
      await asAdmin('get', '/users/no-es-uuid').expect(400);
      await asAdmin('get', '/users').query({ sortBy: 'password' }).expect(400);
    });
  });

  describe('editar (R2, R7, R8, R9)', () => {
    it('cambia nombre y correo, y lo registra en la bitácora; el rol ya no se edita aquí', async () => {
      const { user } = await createViaApi();
      const email = `${randomUUID().slice(0, 12)}@Editados.test`;

      await asAdmin('patch', `/users/${user.id}`)
        .send({ fullName: 'Nombre Editado', role: UserRole.Coordinator })
        .expect(400);
      const res = await asAdmin('patch', `/users/${user.id}`)
        .send({ fullName: 'Nombre Editado', email })
        .expect(200);

      expect(res.body).toMatchObject({
        id: user.id,
        fullName: 'Nombre Editado',
        email: email.toLowerCase(),
        role: UserRole.Teacher,
      });
      const rows = await auditRows(user.id);
      const edit = rows.find((row) => row.action === 'Editar usuario');
      expect(edit).toMatchObject({ userId: admin.id, role: UserRole.Administrator });
      expect(edit?.dataBefore).toMatchObject({ fullName: user.fullName });
      expectNoSecrets(rows);
    });

    it('permite conservar el propio correo y rechaza el de otro usuario con 409', async () => {
      const first = await createViaApi();
      const second = await createViaApi();

      await asAdmin('patch', `/users/${first.user.id}`)
        .send({ email: first.user.email })
        .expect(200);
      await asAdmin('patch', `/users/${first.user.id}`)
        .send({ email: second.body.email.toUpperCase() })
        .expect(409);
      const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: first.user.id } });
      expect(unchanged.institutionalEmail).toBe(first.user.email);
    });

    it('un administrador no puede cambiar su propio rol (409) pero sí su nombre', async () => {
      const self = await createTestUser(app, { role: UserRole.Administrator });
      const cookies = await signIn(app, self);
      const asSelf = (method: 'patch' | 'put', path: string) =>
        asUser(app, method, path, cookies, 'access');

      await asSelf('put', `/users/${self.id}/role`).send({ role: UserRole.Teacher }).expect(409);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: self.id } })).role).toBe(
        UserRole.Administrator,
      );
      // Repetir su rol actual no cambia nada; su nombre sí puede editarlo.
      await asSelf('put', `/users/${self.id}/role`)
        .send({ role: UserRole.Administrator })
        .expect(200);
      await asSelf('patch', `/users/${self.id}`).send({ fullName: 'Nombre Propio' }).expect(200);
      await asUser(app, 'get', '/auth/me', cookies, 'access').expect(200);
    });

    it('rechaza un PATCH vacío y un id inexistente', async () => {
      const { user } = await createViaApi();

      await asAdmin('patch', `/users/${user.id}`).send({}).expect(400);
      await asAdmin('patch', `/users/${randomUUID()}`).send({ fullName: 'Nadie' }).expect(404);
    });
  });

  describe('estado (R3, R7, R9)', () => {
    it('al desactivar revoca todas las sesiones y bloquea el ingreso; al reactivar vuelve a permitirlo', async () => {
      const user = await createTestUser(app);
      const first = await signIn(app, user);
      const second = await signIn(app, user);

      const res = await asAdmin('patch', `/users/${user.id}/status`)
        .send({ status: UserStatus.Inactive })
        .expect(200);

      expect(res.body).toMatchObject({ id: user.id, status: UserStatus.Inactive });
      await asUser(app, 'get', '/auth/me', first, 'access').expect(401);
      await asUser(app, 'post', '/auth/refresh', second, 'refresh').expect(401);
      await login(app, { email: user.email, password: user.password }).expect(401);
      const sessions = await prisma.session.findMany({ where: { userId: user.id } });
      expect(sessions.every((s) => s.revocationReason === 'desactivacion')).toBe(true);

      await asAdmin('patch', `/users/${user.id}/status`)
        .send({ status: UserStatus.Active })
        .expect(200);
      await login(app, { email: user.email, password: user.password }).expect(200);
      const rows = await auditRows(user.id);
      expect(rows.map((row) => row.action)).toEqual([
        'Cambiar el estado de un usuario',
        'Cambiar el estado de un usuario',
      ]);
      expect(rows.map((row) => row.detail)).toEqual(['inactivo', 'activo']);
      expectNoSecrets(rows);
    });

    it('un administrador no puede desactivarse a sí mismo (409)', async () => {
      const self = await createTestUser(app, { role: UserRole.Administrator });
      const cookies = await signIn(app, self);

      await asUser(app, 'patch', `/users/${self.id}/status`, cookies, 'access')
        .send({ status: UserStatus.Inactive })
        .expect(409);

      expect((await prisma.user.findUniqueOrThrow({ where: { id: self.id } })).status).toBe(
        UserStatus.Active,
      );
      await asUser(app, 'get', '/auth/me', cookies, 'access').expect(200);
    });

    it('rechaza un estado desconocido con 400', async () => {
      const { user } = await createViaApi();

      await asAdmin('patch', `/users/${user.id}/status`).send({ status: 'bloqueado' }).expect(400);
    });
  });

  describe('cambiar el rol (R10 a R13)', () => {
    const roleOf = async (id: string) =>
      (await prisma.user.findUniqueOrThrow({ where: { id } })).role;

    /** Grado, grupo y área nuevos, con un año lectivo propio para no chocar con otras suites. */
    async function structure(coordinatorId: string | null = null) {
      const level = await prisma.educationLevel.create({
        data: { name: `Nivel ${randomUUID().slice(0, 8)}`, sortOrder: 1 },
      });
      const grade = await prisma.grade.create({
        data: {
          name: `Grado ${randomUUID().slice(0, 8)}`,
          levelId: level.id,
          sortOrder: 1,
          coordinatorId,
        },
      });
      const group = await prisma.group.create({
        data: { gradeId: grade.id, name: `Grupo ${randomUUID().slice(0, 8)}` },
      });
      const area = await prisma.area.create({
        data: { name: `Área ${randomUUID().slice(0, 8)}`, type: 'asignatura' },
      });
      const start = 3000 + Math.floor(Math.random() * 6000);
      const schoolYear = `${start}-${start + 1}`;
      await prisma.schoolYear.create({ data: { code: schoolYear } });
      return { grade, group, area, schoolYear };
    }

    it('de docente a coordinación retira sus asignaciones y su dirección de grupo, conserva sus registros y deja constancia', async () => {
      const teacher = await createTestUser(app);
      const teacherCookies = await signIn(app, teacher);
      const { grade, group, area, schoolYear } = await structure();
      const oldYear = `${Number(schoolYear.slice(0, 4)) - 1000}-${Number(schoolYear.slice(0, 4)) - 999}`;
      await prisma.schoolYear.create({ data: { code: oldYear } });
      const homeroom = await prisma.teacherAssignment.create({
        data: {
          teacherId: teacher.id,
          groupId: group.id,
          areaId: area.id,
          schoolYear,
          isHomeroomTeacher: true,
        },
      });
      const earlier = await prisma.teacherAssignment.create({
        data: { teacherId: teacher.id, groupId: group.id, areaId: area.id, schoolYear: oldYear },
      });
      const note = await createNote(app, teacherCookies, { gradeId: grade.id });

      const res = await asAdmin('put', `/users/${teacher.id}/role`)
        .send({ role: UserRole.Coordinator })
        .expect(200);

      expect(res.body).toMatchObject({ id: teacher.id, role: UserRole.Coordinator });
      const assignments = await prisma.teacherAssignment.findMany({
        where: { id: { in: [homeroom.id, earlier.id] } },
      });
      expect(assignments).toHaveLength(2);
      expect(assignments.every((item) => item.status === 'retirada')).toBe(true);
      expect(assignments.every((item) => !item.isHomeroomTeacher)).toBe(true);
      expect(
        await prisma.observerNote.count({ where: { id: note.id, teacherId: teacher.id } }),
      ).toBe(1);
      const rows = await auditRows(teacher.id);
      expect(rows.map((row) => row.action)).toEqual([
        'Retiró asignaciones por cambio de rol',
        'Cambió el rol',
      ]);
      expect(rows[0]).toMatchObject({
        userId: admin.id,
        role: UserRole.Administrator,
        detail: expect.stringContaining('dirección de grupo') as string,
      });
      expect(rows[1]?.dataBefore).toMatchObject({ role: UserRole.Teacher });
      expect(rows[1]?.dataAfter).toMatchObject({ role: UserRole.Coordinator });
      expectNoSecrets(rows);
      // La sesión anterior se revocó.
      await asUser(app, 'get', '/auth/me', teacherCookies, 'access').expect(401);
    });

    it('de coordinación a otro rol deja sus grados sin coordinadora y lo registra; desactivarla no los toca (Q9)', async () => {
      const coordinator = await createTestUser(app, { role: UserRole.Coordinator });
      const { grade } = await structure(coordinator.id);

      await asAdmin('patch', `/users/${coordinator.id}/status`)
        .send({ status: UserStatus.Inactive })
        .expect(200);
      expect(
        (await prisma.grade.findUniqueOrThrow({ where: { id: grade.id } })).coordinatorId,
      ).toBe(coordinator.id);
      await asAdmin('patch', `/users/${coordinator.id}/status`)
        .send({ status: UserStatus.Active })
        .expect(200);

      await asAdmin('put', `/users/${coordinator.id}/role`)
        .send({ role: UserRole.Teacher })
        .expect(200);

      expect(
        (await prisma.grade.findUniqueOrThrow({ where: { id: grade.id } })).coordinatorId,
      ).toBe(null);
      const rows = await auditRows(coordinator.id);
      expect(rows.map((row) => row.action)).toContain(
        'Dejó grados sin coordinadora por cambio de rol',
      );
      expect(rows.find((row) => row.action.startsWith('Dejó grados'))?.detail).toBe(grade.name);
    });

    it('de docente a administración retira asignaciones y no toca grados; de administración a docente no cambia nada más', async () => {
      const teacher = await createTestUser(app);
      const { group, area, schoolYear } = await structure();
      await prisma.teacherAssignment.create({
        data: { teacherId: teacher.id, groupId: group.id, areaId: area.id, schoolYear },
      });

      await asAdmin('put', `/users/${teacher.id}/role`)
        .send({ role: UserRole.Administrator })
        .expect(200);
      expect(
        await prisma.teacherAssignment.count({
          where: { teacherId: teacher.id, status: 'activa' },
        }),
      ).toBe(0);

      await asAdmin('put', `/users/${teacher.id}/role`)
        .send({ role: UserRole.Teacher })
        .expect(200);
      const rows = await auditRows(teacher.id);
      expect(rows.map((row) => row.action)).toEqual([
        'Retiró asignaciones por cambio de rol',
        'Cambió el rol',
        'Cambió el rol',
      ]);
    });

    it('repetir el rol actual no cambia nada, no revoca sesiones ni retira asignaciones', async () => {
      const teacher = await createTestUser(app);
      const cookies = await signIn(app, teacher);
      const { group, area, schoolYear } = await structure();
      await prisma.teacherAssignment.create({
        data: { teacherId: teacher.id, groupId: group.id, areaId: area.id, schoolYear },
      });

      await asAdmin('put', `/users/${teacher.id}/role`)
        .send({ role: UserRole.Teacher })
        .expect(200);

      await asUser(app, 'get', '/auth/me', cookies, 'access').expect(200);
      expect(
        await prisma.teacherAssignment.count({
          where: { teacherId: teacher.id, status: 'activa' },
        }),
      ).toBe(1);
    });

    it('rechaza un rol desconocido (400) y un usuario inexistente (404)', async () => {
      const { user } = await createViaApi();

      await asAdmin('put', `/users/${user.id}/role`).send({ role: 'rector' }).expect(400);
      await asAdmin('put', `/users/${user.id}/role`).send({}).expect(400);
      await asAdmin('put', `/users/${user.id}/role`)
        .send({ role: UserRole.Coordinator, extra: 1 })
        .expect(400);
      await asAdmin('put', `/users/${randomUUID()}/role`)
        .send({ role: UserRole.Teacher })
        .expect(404);
      expect(await roleOf(user.id)).toBe(UserRole.Teacher);
    });

    it('si un efecto falla, el rol, las asignaciones y las sesiones quedan como estaban', async () => {
      const teacher = await createTestUser(app);
      const cookies = await signIn(app, teacher);
      const { group, area, schoolYear } = await structure();
      await prisma.teacherAssignment.create({
        data: { teacherId: teacher.id, groupId: group.id, areaId: area.id, schoolYear },
      });
      const spy = jest
        .spyOn(app.get(TeacherAssignmentsService), 'onRoleChange')
        .mockRejectedValueOnce(new Error('falla simulada'));

      await asAdmin('put', `/users/${teacher.id}/role`)
        .send({ role: UserRole.Coordinator })
        .expect(500);

      spy.mockRestore();
      expect(await roleOf(teacher.id)).toBe(UserRole.Teacher);
      await asUser(app, 'get', '/auth/me', cookies, 'access').expect(200);
      expect(await auditRows(teacher.id)).toEqual([]);
    });

    it('nunca deja la plataforma sin un administrador activo: 409 al degradar o desactivar al último, sin cambios (R11)', async () => {
      // Las demás suites comparten la base y crean administradores: se simula que este es el último.
      const last = await createTestUser(app, { role: UserRole.Administrator });
      const cookies = await signIn(app, last);
      const spy = jest
        .spyOn(app.get(USER_REPOSITORY), 'lockActiveAdministrators')
        .mockResolvedValue([last.id]);

      const degrade = await asAdmin('put', `/users/${last.id}/role`)
        .send({ role: UserRole.Coordinator })
        .expect(409);
      const deactivate = await asAdmin('patch', `/users/${last.id}/status`)
        .send({ status: UserStatus.Inactive })
        .expect(409);

      expect(apiErrorBodySchema.parse(degrade.body).message).toBe(
        'Debe quedar al menos un administrador activo',
      );
      expect(apiErrorBodySchema.parse(deactivate.body).code).toBe('conflicto');
      expect(await prisma.user.findUniqueOrThrow({ where: { id: last.id } })).toMatchObject({
        role: UserRole.Administrator,
        status: UserStatus.Active,
      });
      await asUser(app, 'get', '/users', cookies, 'access').expect(200);
      expect(await auditRows(last.id)).toEqual([]);

      // Con otro administrador activo, sí se puede.
      spy.mockResolvedValue([last.id, admin.id]);
      await asAdmin('put', `/users/${last.id}/role`)
        .send({ role: UserRole.Coordinator })
        .expect(200);
      spy.mockRestore();
    });
  });

  describe('restablecer la contraseña (R5, R9, R10)', () => {
    it('reemplaza la credencial, revoca las sesiones y lo registra sin la contraseña', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);
      const password = randomPassword();

      await asAdmin('put', `/users/${user.id}/password`).send({ password }).expect(204);

      await asUser(app, 'get', '/auth/me', cookies, 'access').expect(401);
      await login(app, { email: user.email, password: user.password }).expect(401);
      await login(app, { email: user.email, password }).expect(200);
      const sessions = await prisma.session.findMany({
        where: { userId: user.id, revokedAt: { not: null } },
      });
      expect(sessions.every((s) => s.revocationReason === 'contrasena')).toBe(true);
      const rows = await auditRows(user.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: admin.id,
        role: UserRole.Administrator,
        detail: 'Contraseña restablecida',
      });
      expectNoSecrets(rows, password);
    });

    it('rechaza con 400 una contraseña corta y con 404 un usuario inexistente', async () => {
      const user = await createTestUser(app);

      await asAdmin('put', `/users/${user.id}/password`).send({ password: 'corta' }).expect(400);
      await asAdmin('put', `/users/${randomUUID()}/password`)
        .send({ password: randomPassword() })
        .expect(404);
      await login(app, { email: user.email, password: user.password }).expect(200);
    });
  });
});
