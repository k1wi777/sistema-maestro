import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, UserRole, UserStatus, type User } from '@gns/shared';
import request from 'supertest';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import {
  asUser,
  createTestUser,
  login,
  randomPassword,
  serverOf,
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
    prisma.auditLog.findMany({ where: { entityId, type: 'coordinacion' }, orderBy: { id: 'asc' } });

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
          as('patch', `/users/${target.id}`).send({ role: UserRole.Administrator }),
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

    it('sin sesión recibe 401 no_autenticado', async () => {
      const res = await request(serverOf(app)).get('/users').expect(401);

      expect(apiErrorBodySchema.parse(res.body).code).toBe('no_autenticado');
      await request(serverOf(app)).post('/users').send(newUserBody()).expect(401);
    });

    it('un cambio de rol surte efecto en la siguiente petición sin revocar la sesión', async () => {
      const other = await createTestUser(app, { role: UserRole.Administrator });
      const cookies = await signIn(app, other);
      await asUser(app, 'get', '/users', cookies, 'access').expect(200);

      await asAdmin('patch', `/users/${other.id}`).send({ role: UserRole.Teacher }).expect(200);

      await asUser(app, 'get', '/users', cookies, 'access').expect(403);
      await asUser(app, 'get', '/auth/me', cookies, 'access').expect(200);
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
        type: 'coordinacion',
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
    it('cambia nombre, correo y rol, y lo registra en la bitácora', async () => {
      const { user } = await createViaApi();
      const email = `${randomUUID().slice(0, 12)}@Editados.test`;

      const res = await asAdmin('patch', `/users/${user.id}`)
        .send({ fullName: 'Nombre Editado', email, role: UserRole.Coordinator })
        .expect(200);

      expect(res.body).toMatchObject({
        id: user.id,
        fullName: 'Nombre Editado',
        email: email.toLowerCase(),
        role: UserRole.Coordinator,
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
      const asSelf = (method: 'patch', path: string) =>
        asUser(app, method, path, cookies, 'access');

      await asSelf('patch', `/users/${self.id}`).send({ role: UserRole.Teacher }).expect(409);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: self.id } })).role).toBe(
        UserRole.Administrator,
      );
      await asSelf('patch', `/users/${self.id}`).send({ role: UserRole.Administrator }).expect(200);
      await asSelf('patch', `/users/${self.id}`).send({ fullName: 'Nombre Propio' }).expect(200);
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
