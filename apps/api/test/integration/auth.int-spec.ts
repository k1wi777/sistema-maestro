import { Writable } from 'node:stream';
import type { INestApplication } from '@nestjs/common';
import { apiErrorBodySchema, UserStatus } from '@gns/shared';
import request from 'supertest';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  asUser,
  cookiesFrom,
  createTestUser,
  login,
  randomPassword,
  serverOf,
  setCookieNamed,
  setCookiesOf,
  signIn,
  type Cookies,
} from './support/session';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('autenticación y sesión', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const logLines: string[] = [];

  beforeAll(async () => {
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        logLines.push(chunk.toString());
        done();
      },
    });
    app = await createTestApp({ accessLogStream: stream, config: { LOG_LEVEL: 'info' } });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const sessionOf = (cookies: Cookies) =>
    prisma.session.findUniqueOrThrow({ where: { id: cookies.refresh.split('.')[0] } });
  const refresh = (cookies: Cookies) => asUser(app, 'post', '/auth/refresh', cookies, 'refresh');
  const me = (cookies: Cookies) => asUser(app, 'get', '/auth/me', cookies, 'access');

  describe('ingreso (R13, R14, R25, R26)', () => {
    it('devuelve el usuario actual sin tokens en el cuerpo y con cookies httpOnly SameSite=Strict', async () => {
      const user = await createTestUser(app);

      const res = await login(app, { email: user.email, password: user.password }).expect(200);

      expect(res.body).toEqual({
        id: user.id,
        fullName: expect.any(String) as string,
        email: user.email,
        role: user.role,
      });
      const { access, refresh: refreshToken } = cookiesFrom(res);
      expect(JSON.stringify(res.body)).not.toContain(access);
      expect(JSON.stringify(res.body)).not.toContain(refreshToken);

      const accessCookie = setCookieNamed(res, ACCESS_COOKIE);
      const refreshCookie = setCookieNamed(res, REFRESH_COOKIE);
      for (const cookie of [accessCookie, refreshCookie]) {
        expect(cookie.attributes).toEqual(expect.arrayContaining(['httponly', 'samesite=strict']));
        // AUTH_COOKIE_SECURE=false en el entorno de pruebas (http://localhost).
        expect(cookie.attributes).not.toContain('secure');
      }
      expect(accessCookie.attributes).toContain('path=/');
      expect(refreshCookie.attributes).toContain('path=/auth');
    });

    it('sin «mantener la sesión» emite cookies de sesión del navegador y la sesión no tiene máximo', async () => {
      const user = await createTestUser(app);

      const res = await login(app, { email: user.email, password: user.password }).expect(200);

      for (const cookie of setCookiesOf(res)) {
        expect(
          cookie.attributes.some((a) => a.startsWith('max-age') || a.startsWith('expires')),
        ).toBe(false);
      }
      expect((await sessionOf(cookiesFrom(res))).expiresAt).toBeNull();
    });

    it('con «mantener la sesión» emite cookies persistentes y la sesión vence a los 7 días', async () => {
      const user = await createTestUser(app);

      const res = await login(app, {
        email: user.email,
        password: user.password,
        rememberMe: true,
      }).expect(200);

      const maxAge = (name: string) =>
        Number(
          setCookieNamed(res, name)
            .attributes.find((a) => a.startsWith('max-age='))
            ?.slice('max-age='.length),
        );
      expect(maxAge(ACCESS_COOKIE)).toBe(15 * 60);
      expect(maxAge(REFRESH_COOKIE)).toBeGreaterThan(7 * 24 * 3600 - 60);
      expect(maxAge(REFRESH_COOKIE)).toBeLessThanOrEqual(7 * 24 * 3600);
      const session = await sessionOf(cookiesFrom(res));
      expect(session.expiresAt?.getTime()).toBeCloseTo(session.createdAt.getTime() + 7 * DAY, -4);
    });

    it('repite el tipo de cookie en cada renovación y no extiende el máximo', async () => {
      const user = await createTestUser(app);
      const first = cookiesFrom(
        await login(app, { email: user.email, password: user.password, rememberMe: true }),
      );
      const before = await sessionOf(first);

      const res = await refresh(first).expect(200);

      expect(
        setCookieNamed(res, REFRESH_COOKIE).attributes.some((a) => a.startsWith('max-age=')),
      ).toBe(true);
      expect((await sessionOf(first)).expiresAt).toEqual(before.expiresAt);
    });

    it('responde el mismo 401 si el correo no existe, la contraseña es incorrecta, no hay credencial o está inactivo', async () => {
      const real = await createTestUser(app);
      const noCredential = await createTestUser(app, { withPassword: false });
      const inactive = await createTestUser(app, { status: UserStatus.Inactive });
      const attempts = [
        { email: `nadie-${real.email}`, password: real.password },
        { email: real.email, password: randomPassword() },
        { email: noCredential.email, password: noCredential.password },
        { email: inactive.email, password: inactive.password },
      ];

      const bodies = [];
      for (const attempt of attempts) {
        const res = await login(app, attempt).expect(401);
        expect(setCookiesOf(res)).toEqual([]);
        const { statusCode, code, message, errors } = apiErrorBodySchema.parse(res.body);
        bodies.push({ statusCode, code, message, errors });
      }

      expect(bodies[0]).toMatchObject({ statusCode: 401, code: 'no_autenticado' });
      for (const body of bodies) {
        expect(body).toEqual(bodies[0]);
      }
    });

    it('acepta el correo en otras mayúsculas', async () => {
      const user = await createTestUser(app);

      await login(app, { email: user.email.toUpperCase(), password: user.password }).expect(200);
    });

    it('rechaza con 400 un cuerpo sin contraseña', async () => {
      await request(serverOf(app)).post('/auth/login').send({ email: 'a@b.co' }).expect(400);
    });
  });

  describe('perfil (R18, R19)', () => {
    it('devuelve id, nombre, correo y rol de la sesión', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);

      const res = await me(cookies).expect(200);

      expect(res.body).toEqual({
        id: user.id,
        fullName: expect.any(String) as string,
        email: user.email,
        role: user.role,
      });
    });

    it('responde 401 sin cookie, con un token basura o con el de renovación como acceso', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);

      await request(serverOf(app)).get('/auth/me').expect(401);
      await request(serverOf(app))
        .get('/auth/me')
        .set('Cookie', `${ACCESS_COOKIE}=no-es-un-jwt`)
        .expect(401);
      await request(serverOf(app))
        .get('/auth/me')
        .set('Cookie', `${ACCESS_COOKIE}=${cookies.refresh}`)
        .expect(401);
    });

    it('no acepta un token de acceso firmado con otro secreto', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);
      const [header, payload] = cookies.access.split('.');

      await request(serverOf(app))
        .get('/auth/me')
        .set('Cookie', `${ACCESS_COOKIE}=${header}.${payload}.firma-falsa`)
        .expect(401);
    });
  });

  describe('renovación (R16, R27, R28)', () => {
    it('emite tokens nuevos, invalida el anterior y reinicia la inactividad', async () => {
      const user = await createTestUser(app);
      const first = await signIn(app, user);
      await prisma.session.update({
        where: { id: first.refresh.split('.')[0] },
        data: { renewedAt: new Date(Date.now() - 20 * HOUR) },
      });

      const res = await refresh(first).expect(200);

      expect(res.body).toMatchObject({ id: user.id, email: user.email });
      const second = cookiesFrom(res);
      expect(second.refresh).not.toBe(first.refresh);
      const session = await sessionOf(first);
      expect(session.generation).toBe(1);
      expect(Date.now() - session.renewedAt.getTime()).toBeLessThan(60_000);
      await me(second).expect(200);
    });

    it('el token anterior deja de valer tras el margen y eso revoca todas las sesiones del usuario', async () => {
      const user = await createTestUser(app);
      const first = await signIn(app, user);
      const otherDevice = await signIn(app, user);
      await refresh(first).expect(200);
      await prisma.session.update({
        where: { id: first.refresh.split('.')[0] },
        data: { rotatedAt: new Date(Date.now() - 60_000) },
      });
      logLines.length = 0;

      const res = await refresh(first).expect(401);

      for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
        const cleared = setCookieNamed(res, name);
        expect(cleared.value).toBe('');
        expect(cleared.attributes.some((a) => a.startsWith('expires=thu, 01 jan 1970'))).toBe(true);
      }
      const sessions = await prisma.session.findMany({ where: { userId: user.id } });
      expect(sessions).toHaveLength(2);
      for (const session of sessions) {
        expect(session.revokedAt).not.toBeNull();
        expect(session.revocationReason).toBe('reutilizacion');
      }
      await me(otherDevice).expect(401);
      expect(logLines.join('')).not.toContain(first.refresh);
    });

    it('dentro del margen devuelve el token vigente de la misma sesión, sin rotar ni crear otra', async () => {
      const user = await createTestUser(app);
      const first = await signIn(app, user);
      const rotated = cookiesFrom(await refresh(first).expect(200));

      const res = await refresh(first).expect(200);

      expect(setCookieNamed(res, REFRESH_COOKIE).value).toBe(rotated.refresh);
      const session = await sessionOf(first);
      expect(session.generation).toBe(1);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
      await me(cookiesFrom(res)).expect(200);
    });

    it('dos renovaciones simultáneas con el mismo token terminan con el mismo token vigente', async () => {
      const user = await createTestUser(app);
      const first = await signIn(app, user);

      const [a, b] = await Promise.all([refresh(first), refresh(first)]);

      expect([a.status, b.status]).toEqual([200, 200]);
      expect(setCookieNamed(a, REFRESH_COOKIE).value).toBe(setCookieNamed(b, REFRESH_COOKIE).value);
      expect((await sessionOf(first)).generation).toBe(1);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    });

    it('rechaza un token manipulado, uno de otra generación futura y la falta de cookie', async () => {
      const user = await createTestUser(app);
      const first = await signIn(app, user);
      const [sid, , mac] = first.refresh.split('.') as [string, string, string];

      await refresh({ ...first, refresh: `${sid}.0.${mac.slice(0, -2)}xx` }).expect(401);
      await refresh({ ...first, refresh: `${sid}.7.${mac}` }).expect(401);
      await request(serverOf(app)).post('/auth/refresh').expect(401);
      await refresh(first).expect(200);
    });

    it('rechaza la renovación y el acceso tras la inactividad configurada (24 h)', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);
      await prisma.session.update({
        where: { id: cookies.refresh.split('.')[0] },
        data: { renewedAt: new Date(Date.now() - 25 * HOUR) },
      });

      await me(cookies).expect(401);
      await refresh(cookies).expect(401);
    });

    it('rechaza una sesión con «mantener la sesión» al cumplirse su máximo absoluto', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user, true);
      await prisma.session.update({
        where: { id: cookies.refresh.split('.')[0] },
        data: {
          createdAt: new Date(Date.now() - 8 * DAY),
          expiresAt: new Date(Date.now() - DAY),
          renewedAt: new Date(),
        },
      });

      await me(cookies).expect(401);
      await refresh(cookies).expect(401);
    });

    it('no renueva una sesión de un usuario desactivado', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);
      await prisma.user.update({ where: { id: user.id }, data: { status: UserStatus.Inactive } });

      await refresh(cookies).expect(401);
    });
  });

  describe('cierre de sesión (R17)', () => {
    it('revoca la sesión, borra las cookies y la renovación posterior falla', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);
      const other = await signIn(app, user);

      const res = await asUser(app, 'post', '/auth/logout', cookies).expect(204);

      expect(setCookieNamed(res, ACCESS_COOKIE).value).toBe('');
      expect(setCookieNamed(res, REFRESH_COOKIE).value).toBe('');
      expect((await sessionOf(cookies)).revocationReason).toBe('cierre');
      await me(cookies).expect(401);
      await refresh(cookies).expect(401);
      await me(other).expect(200);
    });

    it('responde 204 aunque no haya sesión o ya estuviera revocada', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);
      await asUser(app, 'post', '/auth/logout', cookies).expect(204);

      await asUser(app, 'post', '/auth/logout', cookies).expect(204);
      const res = await request(serverOf(app)).post('/auth/logout').expect(204);
      expect(setCookieNamed(res, REFRESH_COOKIE).value).toBe('');
    });

    it('con solo el token de acceso revoca la sesión de ese token', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);

      await asUser(app, 'post', '/auth/logout', cookies, 'access').expect(204);

      expect((await sessionOf(cookies)).revokedAt).not.toBeNull();
    });
  });

  describe('cambio de contraseña propio (R20)', () => {
    it('con la actual incorrecta responde 401 y no cambia nada', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);

      await asUser(app, 'put', '/auth/password', cookies)
        .send({ currentPassword: randomPassword(), newPassword: randomPassword() })
        .expect(401);

      await login(app, { email: user.email, password: user.password }).expect(200);
    });

    it('reemplaza la credencial y revoca las demás sesiones, no la actual', async () => {
      const user = await createTestUser(app);
      const current = await signIn(app, user);
      const other = await signIn(app, user);
      const newPassword = randomPassword();

      await asUser(app, 'put', '/auth/password', current)
        .send({ currentPassword: user.password, newPassword })
        .expect(204);

      await me(current).expect(200);
      await me(other).expect(401);
      expect((await sessionOf(other)).revocationReason).toBe('contrasena');
      await login(app, { email: user.email, password: user.password }).expect(401);
      await login(app, { email: user.email, password: newPassword }).expect(200);
    });

    it('rechaza una contraseña nueva de menos de 12 caracteres con 400 y el campo', async () => {
      const user = await createTestUser(app);
      const cookies = await signIn(app, user);

      const res = await asUser(app, 'put', '/auth/password', cookies)
        .send({ currentPassword: user.password, newPassword: 'corta' })
        .expect(400);

      expect(apiErrorBodySchema.parse(res.body).errors?.[0]?.field).toBe('newPassword');
    });

    it('exige sesión', async () => {
      await request(serverOf(app))
        .put('/auth/password')
        .send({ currentPassword: 'x', newPassword: randomPassword() })
        .expect(401);
    });
  });

  describe('secretos fuera de los logs (R11)', () => {
    it('el log de acceso no contiene la contraseña ni los tokens', async () => {
      const user = await createTestUser(app);
      logLines.length = 0;

      const cookies = await signIn(app, user);
      await me(cookies).expect(200);
      await refresh(cookies).expect(200);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const log = logLines.join('');
      expect(log).toContain('/auth/login');
      for (const secret of [user.password, cookies.access, cookies.refresh]) {
        expect(log).not.toContain(secret);
      }
    });
  });
});

describe('cookies de sesión en producción (R13)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ config: { AUTH_COOKIE_SECURE: true } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('añade Secure a ambas cookies cuando AUTH_COOKIE_SECURE es verdadero', async () => {
    const user = await createTestUser(app);

    const res = await login(app, { email: user.email, password: user.password }).expect(200);

    for (const cookie of setCookiesOf(res)) {
      expect(cookie.attributes).toContain('secure');
    }
  });
});

describe('límite de intentos de ingreso (R15)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ config: { LOGIN_MAX_ATTEMPTS: 3, LOGIN_WINDOW_SECONDS: 300 } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 429 sin verificar la contraseña al superar los intentos de la misma IP y correo', async () => {
    const user = await createTestUser(app);
    const other = await createTestUser(app);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await login(app, { email: user.email, password: randomPassword() }).expect(401);
    }

    // Ni siquiera la contraseña correcta se verifica una vez superado el límite.
    const blocked = await login(app, { email: user.email, password: user.password }).expect(429);
    expect(apiErrorBodySchema.parse(blocked.body).code).toBe('demasiadas_peticiones');
    expect(setCookiesOf(blocked)).toEqual([]);
    // Otro correo desde la misma IP no se ve afectado.
    await login(app, { email: other.email, password: other.password }).expect(200);
  });

  it('no limita otros endpoints con el límite de ingreso', async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await request(serverOf(app)).get('/faq-example').expect(200);
    }
  });
});
