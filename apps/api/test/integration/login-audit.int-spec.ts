import type { INestApplication } from '@nestjs/common';
import {
  apiErrorBodySchema,
  AuditLogType,
  AUDIT_UNKNOWN_ROLE,
  UserRole,
  UserStatus,
} from '@gns/shared';
import request from 'supertest';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import {
  asUser,
  cookiesFrom,
  createTestUser,
  login,
  randomPassword,
  serverOf,
  signIn,
} from './support/session';

const FAILED = 'Intento de ingreso fallido';

/** El JSON completo de las filas, para comprobar que no contiene datos sensibles. */
const dump = (rows: unknown[]) =>
  JSON.stringify(rows, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );

describe('registro de ingresos en la bitácora', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const loginRows = (userId: string) =>
    prisma.auditLog.findMany({
      where: { type: AuditLogType.Login, userId },
      orderBy: { id: 'asc' },
    });

  describe('ingreso correcto (R15)', () => {
    it('escribe la fila con usuario, rol y sesión', async () => {
      const user = await createTestUser(app, { role: UserRole.Coordinator });

      await login(app, { email: user.email, password: user.password }).expect(200);

      const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
      const rows = await loginRows(user.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        role: UserRole.Coordinator,
        action: 'Ingreso',
        entity: 'sesion',
        entityId: session.id,
        detail: 'contrasena',
      });
      expect(rows[0]?.occurredAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
    });
  });

  describe('intentos fallidos (R16, R17)', () => {
    it('registra la contraseña incorrecta con el usuario y su rol', async () => {
      const user = await createTestUser(app, { role: UserRole.Administrator });
      const wrong = randomPassword();

      await login(app, { email: user.email, password: wrong }).expect(401);

      const rows = await loginRows(user.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        role: UserRole.Administrator,
        action: FAILED,
        entity: 'usuario',
        entityId: user.id,
        detail: 'Contraseña incorrecta',
      });
      expect(dump(rows)).not.toContain(wrong);
      expect(dump(rows)).not.toContain(user.email);
    });

    it('registra la cuenta inactiva con el usuario y su rol', async () => {
      const user = await createTestUser(app, { status: UserStatus.Inactive });

      await login(app, { email: user.email, password: user.password }).expect(401);

      const rows = await loginRows(user.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        role: UserRole.Teacher,
        action: FAILED,
        detail: 'Cuenta inactiva',
      });
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    });

    it('registra el correo sin cuenta con usuario nulo y rol desconocido, sin el correo enviado', async () => {
      const email = `nadie-${randomPassword()}@sesion.test`;
      const where = {
        type: AuditLogType.Login,
        action: FAILED,
        detail: 'Correo no registrado',
        userId: null,
      };
      const before = await prisma.auditLog.count({ where });

      await login(app, { email, password: randomPassword() }).expect(401);

      expect(await prisma.auditLog.count({ where })).toBeGreaterThan(before);
      const rows = await prisma.auditLog.findMany({ where, orderBy: { id: 'desc' }, take: 20 });
      expect(rows[0]).toMatchObject({
        role: AUDIT_UNKNOWN_ROLE,
        entity: null,
        entityId: null,
      });
      expect(dump(rows)).not.toContain(email);
      expect(dump(rows)).not.toContain('@');
    });

    it('responde la misma 401 sea cual sea el motivo', async () => {
      const known = await createTestUser(app);
      const inactive = await createTestUser(app, { status: UserStatus.Inactive });
      const attempts = [
        { email: known.email, password: randomPassword() },
        { email: inactive.email, password: inactive.password },
        { email: `nadie-${randomPassword()}@sesion.test`, password: randomPassword() },
      ];

      const bodies: unknown[] = [];
      for (const attempt of attempts) {
        const res = await login(app, attempt).expect(401);
        const { requestId, ...rest } = apiErrorBodySchema.parse(res.body);
        expect(requestId).toBeTruthy();
        bodies.push(rest);
      }

      expect(bodies[1]).toEqual(bodies[0]);
      expect(bodies[2]).toEqual(bodies[0]);
    });

    it('no registra los rechazos por validación (400)', async () => {
      const user = await createTestUser(app);

      await request(serverOf(app)).post('/auth/login').send({ email: user.email }).expect(400);

      expect(await loginRows(user.id)).toHaveLength(0);
    });
  });

  describe('cambio de la propia contraseña (R19)', () => {
    it('lo registra con usuario y rol, sin contraseñas ni hashes', async () => {
      const user = await createTestUser(app, { role: UserRole.Coordinator });
      const cookies = await signIn(app, user);
      const next = randomPassword();

      await asUser(app, 'put', '/auth/password', cookies, 'access')
        .send({ currentPassword: user.password, newPassword: next })
        .expect(204);

      const rows = (await loginRows(user.id)).filter(
        (row) => row.action === 'Cambiar la contraseña propia',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        role: UserRole.Coordinator,
        entity: 'usuario',
        entityId: user.id,
      });
      const text = dump(await loginRows(user.id));
      for (const secret of [user.password, next, 'argon2']) {
        expect(text).not.toContain(secret);
      }
      await login(app, { email: user.email, password: next }).expect(200);
    });

    it('no registra el intento con la contraseña actual incorrecta', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);

      await asUser(app, 'put', '/auth/password', cookies, 'access')
        .send({ currentPassword: randomPassword(), newPassword: randomPassword() })
        .expect(401);

      const rows = await loginRows(user.id);
      expect(rows.map((row) => row.action)).toEqual(['Ingreso']);
    });
  });
});

describe('límite de ingreso y registro (R16)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp({
      withFailures: false,
      config: { LOGIN_MAX_ATTEMPTS: 2, LOGIN_WINDOW_SECONDS: 300 },
    });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('no registra las peticiones rechazadas con 429', async () => {
    const user = await createTestUser(app);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await login(app, { email: user.email, password: randomPassword() }).expect(401);
    }

    await login(app, { email: user.email, password: randomPassword() }).expect(429);

    expect(await prisma.auditLog.count({ where: { userId: user.id, action: FAILED } })).toBe(2);
  });
});

describe('reutilización del token de renovación (R18)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp({
      withFailures: false,
      config: { REFRESH_ROTATION_GRACE_SECONDS: 0 },
    });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('deja la fila aunque la petición responda 401, sin el token', async () => {
    const user = await createTestUser(app, { role: UserRole.Coordinator });
    const res = await login(app, { email: user.email, password: user.password }).expect(200);
    const cookies = cookiesFrom(res);
    await asUser(app, 'post', '/auth/refresh', cookies, 'refresh').expect(200);
    await new Promise((resolve) => setTimeout(resolve, 25));

    await asUser(app, 'post', '/auth/refresh', cookies, 'refresh').expect(401);

    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    const rows = await prisma.auditLog.findMany({
      where: {
        type: AuditLogType.Login,
        userId: user.id,
        action: 'Sesiones revocadas por reutilización del token de renovación',
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      role: UserRole.Coordinator,
      entity: 'sesion',
      entityId: session.id,
    });
    expect(dump(rows)).not.toContain(cookies.refresh);
    expect(session.revokedAt).not.toBeNull();
  });
});
