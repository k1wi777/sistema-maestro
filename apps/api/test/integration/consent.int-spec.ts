import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, ApiErrorCode, AuditLogType, UserRole } from '@gns/shared';
import request from 'supertest';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import {
  asUser,
  createTestUser,
  randomPassword,
  serverOf,
  signIn,
  type Cookies,
  type TestUser,
} from './support/session';

const VERSION = process.env.DATA_POLICY_VERSION ?? '';
const ALL_BOXES = { policy: true, authorization: true, minors: true, security: true };

interface StatusBody {
  policyVersion: string;
  accepted: boolean;
  acceptedAt: string | null;
}

describe('consentimiento de datos', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function pending(role: UserRole = UserRole.Teacher): Promise<{
    user: TestUser;
    cookies: Cookies;
  }> {
    const user = await createTestUser(app, { role, consent: false });
    return { user, cookies: await signIn(app, user) };
  }

  const send = (cookies: Cookies, method: 'get' | 'post', path: string) =>
    asUser(app, method, path, cookies, 'access');

  const accept = (cookies: Cookies, body: unknown = { policyVersion: VERSION, items: ALL_BOXES }) =>
    send(cookies, 'post', '/consent').send(body as object);

  describe('consultar y aceptar (R8, R9, R14)', () => {
    it('informa la versión vigente, sin aceptar y luego aceptada con su fecha', async () => {
      const { cookies } = await pending();

      const before = await send(cookies, 'get', '/consent').expect(200);
      expect(before.body).toEqual({ policyVersion: VERSION, accepted: false, acceptedAt: null });

      const started = Date.now();
      await accept(cookies).expect(201);

      const after = (await send(cookies, 'get', '/consent').expect(200)).body as StatusBody;
      expect(after).toMatchObject({ policyVersion: VERSION, accepted: true });
      expect(new Date(after.acceptedAt ?? '').getTime()).toBeGreaterThanOrEqual(started - 1000);
    });

    it('guarda la aceptación con las cuatro casillas y la escribe en la bitácora', async () => {
      const { user, cookies } = await pending(UserRole.Coordinator);

      const res = await accept(cookies).expect(201);

      const body = res.body as { id: string; policyVersion: string; items: string[] };
      expect(body.policyVersion).toBe(VERSION);
      expect(body.items).toEqual(['politica', 'autorizo', 'menores', 'seguridad']);
      const row = await prisma.dataConsent.findUniqueOrThrow({ where: { id: body.id } });
      expect(row).toMatchObject({ userId: user.id, policyVersion: VERSION });
      expect(row.checkedItems).toEqual(['politica', 'autorizo', 'menores', 'seguridad']);
      const logged = await prisma.auditLog.findMany({
        where: { type: AuditLogType.DataConsent, userId: user.id },
      });
      expect(logged).toHaveLength(1);
      expect(logged[0]).toMatchObject({
        role: UserRole.Coordinator,
        entity: 'consentimiento_datos',
        entityId: body.id,
      });
      expect(JSON.stringify(logged[0]?.dataAfter)).toContain(VERSION);
    });
  });

  describe('datos inválidos y conflictos (R10, R11)', () => {
    it.each(['policy', 'authorization', 'minors', 'security'])(
      'responde 400 con el campo items.%s si falta o no está marcada, sin registrar nada',
      async (key) => {
        const { user, cookies } = await pending();
        const missing = { ...ALL_BOXES } as Record<string, boolean>;
        delete missing[key];

        for (const items of [missing, { ...ALL_BOXES, [key]: false }]) {
          const res = await accept(cookies, { policyVersion: VERSION, items }).expect(400);
          expect(apiErrorBodySchema.parse(res.body).errors?.map(({ field }) => field)).toContain(
            `items.${key}`,
          );
        }
        expect(await prisma.dataConsent.count({ where: { userId: user.id } })).toBe(0);
      },
    );

    it('responde 409 con otra versión y no registra nada', async () => {
      const { user, cookies } = await pending();

      await accept(cookies, { policyVersion: 'otra-version', items: ALL_BOXES }).expect(409);

      expect(await prisma.dataConsent.count({ where: { userId: user.id } })).toBe(0);
    });

    it('responde 409 al repetir la aceptación y deja una sola fila en consentimiento y bitácora', async () => {
      const { user, cookies } = await pending();
      await accept(cookies).expect(201);

      await accept(cookies).expect(409);

      expect(await prisma.dataConsent.count({ where: { userId: user.id } })).toBe(1);
      expect(
        await prisma.auditLog.count({ where: { type: AuditLogType.DataConsent, userId: user.id } }),
      ).toBe(1);
    });
  });

  describe('bloqueo sin aviso aceptado (R12)', () => {
    it('solo permite consultar y aceptar el aviso, el usuario propio y la renovación y cierre de sesión', async () => {
      const { cookies } = await pending();

      await send(cookies, 'get', '/consent').expect(200);
      await send(cookies, 'get', '/auth/me').expect(200);
      await asUser(app, 'post', '/auth/refresh', cookies, 'refresh').expect(200);
      await asUser(app, 'post', '/auth/logout', cookies, 'refresh').expect(204);
    });

    it('responde 403 consentimiento_requerido a los demás endpoints con rol', async () => {
      const { cookies } = await pending(UserRole.Administrator);

      for (const [method, path] of [
        ['put', '/auth/password'],
        ['get', '/users'],
      ] as const) {
        const res = await asUser(app, method, path, cookies, 'access')
          .send({ currentPassword: randomPassword(), newPassword: randomPassword() })
          .expect(403);
        expect(apiErrorBodySchema.parse(res.body).code).toBe(ApiErrorCode.ConsentRequired);
      }
    });

    it('responde 401 sin sesión y deja de bloquear al aceptar', async () => {
      const { cookies } = await pending(UserRole.Administrator);
      await request(serverOf(app)).get('/consent').expect(401);
      await send(cookies, 'get', '/users').expect(403);

      await accept(cookies).expect(201);

      await send(cookies, 'get', '/users').expect(200);
    });

    it('prefiere el 403 de consentimiento al de rol insuficiente (R13)', async () => {
      const { cookies } = await pending(UserRole.Teacher);

      const res = await send(cookies, 'get', '/users').expect(403);

      expect(apiErrorBodySchema.parse(res.body).code).toBe(ApiErrorCode.ConsentRequired);
    });
  });
});

describe('cambio de la versión vigente (R7, R12)', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  it('vuelve a bloquear al usuario que aceptó la versión anterior y acepta la nueva', async () => {
    app = await createTestApp({ withFailures: false, config: { DATA_POLICY_VERSION: 'nueva-2' } });
    const user = await createTestUser(app, { consent: false });
    const prisma = app.get(PrismaService);
    await prisma.dataConsent.create({
      data: {
        userId: user.id,
        policyVersion: VERSION,
        acceptedAt: new Date(),
        checkedItems: ['politica', 'autorizo', 'menores', 'seguridad'],
      },
    });
    const cookies = await signIn(app, user);

    const blocked = await asUser(app, 'put', '/auth/password', cookies, 'access')
      .send({})
      .expect(403);
    expect(apiErrorBodySchema.parse(blocked.body).code).toBe(ApiErrorCode.ConsentRequired);
    const status = await asUser(app, 'get', '/consent', cookies, 'access').expect(200);
    expect(status.body).toMatchObject({ policyVersion: 'nueva-2', accepted: false });

    await asUser(app, 'post', '/consent', cookies, 'access')
      .send({ policyVersion: 'nueva-2', items: ALL_BOXES })
      .expect(201);

    expect(await prisma.dataConsent.count({ where: { userId: user.id } })).toBe(2);
  });
});
