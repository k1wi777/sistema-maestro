import { randomUUID } from 'node:crypto';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { apiErrorBodySchema, ApiErrorCode, roleSatisfies, UserRole } from '@gns/shared';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/core/bootstrap/configure-app';
import { AccessDeclarationVerifier } from '../../src/modules/identidad/auth/access-declaration.verifier';
import { createTestApp } from './support/create-test-app';
import { asUser, createTestUser, serverOf, signIn, type Cookies } from './support/session';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface ExpectedRoute {
  method: Method;
  path: string;
  /** `public` o el rol mínimo. */
  access: 'public' | UserRole;
}

const PUBLIC = 'public' as const;
const TEACHER = UserRole.Teacher;
const COORD = UserRole.Coordinator;
const ADMIN = UserRole.Administrator;

// Matriz esperada de TODAS las rutas (incluidas las de prueba). Una ruta nueva, o una cuyo
// acceso cambia, hace fallar la prueba de inventario hasta que se actualice aquí (R6).
const EXPECTED_ROUTES: ExpectedRoute[] = [
  { method: 'post', path: '/auth/login', access: PUBLIC },
  { method: 'post', path: '/auth/refresh', access: PUBLIC },
  { method: 'post', path: '/auth/logout', access: PUBLIC },
  { method: 'get', path: '/auth/me', access: TEACHER },
  { method: 'put', path: '/auth/password', access: TEACHER },
  { method: 'get', path: '/consent', access: TEACHER },
  { method: 'post', path: '/consent', access: TEACHER },
  { method: 'get', path: '/users', access: ADMIN },
  { method: 'get', path: '/users/:id', access: ADMIN },
  { method: 'post', path: '/users', access: ADMIN },
  { method: 'patch', path: '/users/:id', access: ADMIN },
  { method: 'patch', path: '/users/:id/status', access: ADMIN },
  { method: 'put', path: '/users/:id/password', access: ADMIN },
  { method: 'get', path: '/levels', access: TEACHER },
  { method: 'post', path: '/levels', access: ADMIN },
  { method: 'patch', path: '/levels/:id', access: ADMIN },
  { method: 'get', path: '/grades', access: TEACHER },
  { method: 'post', path: '/grades', access: ADMIN },
  { method: 'patch', path: '/grades/:id', access: ADMIN },
  { method: 'get', path: '/areas', access: TEACHER },
  { method: 'post', path: '/areas', access: ADMIN },
  { method: 'patch', path: '/areas/:id', access: ADMIN },
  { method: 'get', path: '/academic-periods', access: TEACHER },
  { method: 'post', path: '/academic-periods', access: ADMIN },
  { method: 'patch', path: '/academic-periods/:id', access: ADMIN },
  { method: 'get', path: '/teacher-assignments', access: COORD },
  { method: 'post', path: '/teacher-assignments', access: COORD },
  { method: 'patch', path: '/teacher-assignments/:id', access: COORD },
  { method: 'patch', path: '/teacher-assignments/:id/status', access: COORD },
  { method: 'get', path: '/me/assignments', access: TEACHER },
  { method: 'get', path: '/school-years', access: TEACHER },
  { method: 'get', path: '/school-years/current', access: TEACHER },
  { method: 'post', path: '/school-years', access: ADMIN },
  { method: 'put', path: '/school-years/:id/current', access: ADMIN },
  { method: 'get', path: '/lesson-plans', access: TEACHER },
  { method: 'get', path: '/lesson-plans/:id', access: TEACHER },
  { method: 'post', path: '/lesson-plans', access: TEACHER },
  { method: 'patch', path: '/lesson-plans/:id', access: TEACHER },
  { method: 'post', path: '/lesson-plans/:id/submit', access: TEACHER },
  { method: 'post', path: '/lesson-plans/:id/void', access: TEACHER },
  { method: 'post', path: '/lesson-plans/:id/resources', access: TEACHER },
  { method: 'delete', path: '/lesson-plans/:id/resources/:resourceId', access: TEACHER },
  { method: 'post', path: '/lesson-plans/:id/approve', access: COORD },
  { method: 'post', path: '/lesson-plans/:id/return', access: COORD },
  { method: 'get', path: '/lesson-plans/:id/reviews', access: TEACHER },
  { method: 'get', path: '/lesson-plan-compliance', access: COORD },
  { method: 'get', path: '/field-journals', access: TEACHER },
  { method: 'get', path: '/field-journals/:id', access: TEACHER },
  { method: 'post', path: '/field-journals', access: TEACHER },
  { method: 'post', path: '/field-journals/:id/entries', access: TEACHER },
  { method: 'patch', path: '/field-journals/:id/entries/:entryId', access: TEACHER },
  { method: 'delete', path: '/field-journals/:id/entries/:entryId', access: TEACHER },
  { method: 'post', path: '/field-journals/:id/submit', access: TEACHER },
  { method: 'post', path: '/field-journals/:id/void', access: TEACHER },
  { method: 'post', path: '/field-journals/:id/approve', access: COORD },
  { method: 'post', path: '/field-journals/:id/return', access: COORD },
  { method: 'get', path: '/field-journals/:id/reviews', access: TEACHER },
  { method: 'get', path: '/observer-notes', access: TEACHER },
  { method: 'get', path: '/observer-notes/:id', access: TEACHER },
  { method: 'post', path: '/observer-notes', access: TEACHER },
  { method: 'patch', path: '/observer-notes/:id', access: TEACHER },
  { method: 'post', path: '/observer-notes/:id/submit', access: TEACHER },
  { method: 'post', path: '/observer-notes/:id/void', access: TEACHER },
  { method: 'post', path: '/observer-notes/:id/approve', access: COORD },
  { method: 'post', path: '/observer-notes/:id/return', access: COORD },
  { method: 'get', path: '/observer-notes/:id/reviews', access: TEACHER },
  { method: 'get', path: '/shared-activities', access: TEACHER },
  { method: 'get', path: '/shared-activities/:id', access: TEACHER },
  { method: 'post', path: '/shared-activities', access: TEACHER },
  { method: 'patch', path: '/shared-activities/:id', access: TEACHER },
  { method: 'delete', path: '/shared-activities/:id', access: TEACHER },
  { method: 'put', path: '/shared-activities/:id/favorite', access: TEACHER },
  { method: 'delete', path: '/shared-activities/:id/favorite', access: TEACHER },
  { method: 'get', path: '/training-plans', access: COORD },
  { method: 'post', path: '/training-plans', access: COORD },
  { method: 'patch', path: '/training-plans/:id', access: COORD },
  { method: 'get', path: '/training-plans/:id/sections', access: COORD },
  { method: 'post', path: '/training-plans/:id/sections', access: COORD },
  { method: 'put', path: '/training-plans/:id/section-order', access: COORD },
  { method: 'patch', path: '/training-sections/:id', access: COORD },
  { method: 'delete', path: '/training-sections/:id', access: COORD },
  { method: 'post', path: '/training-sections/:id/modules', access: COORD },
  { method: 'put', path: '/training-sections/:id/module-order', access: COORD },
  { method: 'get', path: '/training-modules/:id', access: COORD },
  { method: 'patch', path: '/training-modules/:id', access: COORD },
  { method: 'post', path: '/training-modules/:id/publish', access: COORD },
  { method: 'post', path: '/training-modules/:id/withdraw', access: COORD },
  { method: 'post', path: '/training-modules/:id/restore', access: COORD },
  { method: 'post', path: '/training-modules/:id/slides', access: COORD },
  { method: 'patch', path: '/training-modules/:id/slides/:slideId', access: COORD },
  { method: 'delete', path: '/training-modules/:id/slides/:slideId', access: COORD },
  { method: 'put', path: '/training-modules/:id/slide-order', access: COORD },
  { method: 'post', path: '/training-modules/:id/questions', access: COORD },
  { method: 'put', path: '/training-modules/:id/questions/:questionId', access: COORD },
  { method: 'delete', path: '/training-modules/:id/questions/:questionId', access: COORD },
  { method: 'put', path: '/training-modules/:id/question-order', access: COORD },
  { method: 'post', path: '/training-modules/:id/activities', access: COORD },
  { method: 'patch', path: '/training-modules/:id/activities/:activityId', access: COORD },
  { method: 'post', path: '/training-modules/:id/activities/:activityId/withdraw', access: COORD },
  { method: 'post', path: '/training-modules/:id/activities/:activityId/restore', access: COORD },
  { method: 'put', path: '/training-modules/:id/activity-order', access: COORD },
  { method: 'get', path: '/me/training/route', access: TEACHER },
  { method: 'post', path: '/me/training/modules/:moduleId/files/:purpose/url', access: TEACHER },
  { method: 'get', path: '/me/training/certificates', access: TEACHER },
  { method: 'post', path: '/me/training/certificates/:id/download', access: TEACHER },
  { method: 'post', path: '/training-modules/:id/files', access: COORD },
  { method: 'post', path: '/training-modules/:id/files/:fileId/confirm', access: COORD },
  { method: 'delete', path: '/training-modules/:id/files/:purpose', access: COORD },
  { method: 'post', path: '/training-modules/:id/files/:purpose/url', access: COORD },
  { method: 'get', path: '/training-certificates', access: COORD },
  { method: 'post', path: '/training-certificates/:id/download', access: COORD },
  { method: 'get', path: '/certificates/verify/:code', access: PUBLIC },
  { method: 'get', path: '/assistant/faqs', access: TEACHER },
  { method: 'post', path: '/assistant/queries', access: TEACHER },
  { method: 'get', path: '/faqs', access: COORD },
  { method: 'get', path: '/faqs/:id', access: COORD },
  { method: 'post', path: '/faqs', access: COORD },
  { method: 'patch', path: '/faqs/:id', access: COORD },
  { method: 'get', path: '/unanswered-questions', access: COORD },
  { method: 'get', path: '/unanswered-questions/:id', access: COORD },
  { method: 'post', path: '/unanswered-questions/:id/discard', access: COORD },
  { method: 'get', path: '/audit-log', access: COORD },
  { method: 'get', path: '/audit-log/export', access: COORD },
  { method: 'get', path: '/audit-log/:id', access: COORD },
  { method: 'get', path: '/training-tracking/plans/:planId', access: COORD },
  { method: 'get', path: '/training-tracking/plans/:planId/export', access: COORD },
  { method: 'get', path: '/training-tracking/teachers/:teacherId', access: COORD },
  { method: 'get', path: '/me/training/modules/:moduleId', access: TEACHER },
  { method: 'post', path: '/me/training/modules/:moduleId/video-viewed', access: TEACHER },
  { method: 'post', path: '/me/training/modules/:moduleId/presentation-viewed', access: TEACHER },
  { method: 'post', path: '/me/training/modules/:moduleId/challenge', access: TEACHER },
  { method: 'post', path: '/me/training/modules/:moduleId/challenge/answer', access: TEACHER },
  { method: 'post', path: '/me/training/modules/:moduleId/challenge/next', access: TEACHER },
  { method: 'post', path: '/me/training/activities/:activityId/stamps', access: TEACHER },
  { method: 'post', path: '/me/training/activities/:activityId/use', access: TEACHER },
  { method: 'post', path: '/me/training/activities/:activityId/game', access: TEACHER },
  { method: 'post', path: '/me/training/activities/:activityId/game/answer', access: TEACHER },
  { method: 'post', path: '/me/training/activities/:activityId/game/next', access: TEACHER },
  // Solo pruebas: públicos a propósito.
  { method: 'get', path: '/faq-example', access: PUBLIC },
  { method: 'get', path: '/faq-example/:id', access: PUBLIC },
  { method: 'post', path: '/faq-example', access: PUBLIC },
  { method: 'patch', path: '/faq-example/:id', access: PUBLIC },
  { method: 'get', path: '/failures/boom', access: PUBLIC },
  { method: 'get', path: '/failures/unique', access: PUBLIC },
  { method: 'get', path: '/failures/foreign-key', access: PUBLIC },
  { method: 'get', path: '/failures/check', access: PUBLIC },
  { method: 'get', path: '/failures/undeclared', access: PUBLIC },
  { method: 'post', path: '/failures/failing-audited', access: PUBLIC },
  { method: 'post', path: '/failures/bad-audit', access: PUBLIC },
  { method: 'post', path: '/failures/audited-secret', access: PUBLIC },
  { method: 'post', path: '/failures/audited-big', access: PUBLIC },
];

const label = ({ method, path }: { method: string; path: string }) =>
  `${method.toUpperCase()} ${path}`;

describe('control de acceso por rol', () => {
  let app: INestApplication;
  const sessions = new Map<UserRole, Cookies>();

  beforeAll(async () => {
    app = await createTestApp();
    for (const role of Object.values(UserRole)) {
      sessions.set(role, await signIn(app, await createTestUser(app, { role })));
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('declara exactamente el acceso de la matriz esperada en todas las rutas (R1, R5, R6)', () => {
    const actual = app
      .get(AccessDeclarationVerifier)
      .listRoutes()
      .map(({ method, path, access }) => `${label({ method, path })} -> ${access}`)
      .sort();
    const expected = EXPECTED_ROUTES.map((route) => `${label(route)} -> ${route.access}`).sort();

    expect(actual).toEqual(expected);
  });

  describe.each(EXPECTED_ROUTES.filter((route) => route.access !== PUBLIC))(
    '$method $path (rol mínimo $access)',
    (route) => {
      const path = route.path
        .replace(':id', randomUUID())
        .replace(':resourceId', randomUUID())
        .replace(':entryId', randomUUID());
      const call = (cookies?: Cookies) =>
        cookies
          ? asUser(app, route.method, path, cookies, 'access').send({})
          : request(serverOf(app))[route.method](path).send({});

      it('responde 401 no_autenticado sin sesión (R3)', async () => {
        const res = await call().expect(401);

        expect(apiErrorBodySchema.parse(res.body).code).toBe(ApiErrorCode.Unauthenticated);
      });

      it.each(Object.values(UserRole))('con el rol %s', async (role) => {
        const res = await call(sessions.get(role));

        if (roleSatisfies(role, route.access as UserRole)) {
          // Pasa el guard: lo que responda el endpoint (400 por el cuerpo vacío, 404...) no es 401 ni 403.
          expect([401, 403]).not.toContain(res.status);
        } else {
          expect(res.status).toBe(403);
          expect(apiErrorBodySchema.parse(res.body).code).toBe(ApiErrorCode.Forbidden);
        }
      });
    },
  );

  it('deja pasar los endpoints públicos sin sesión', async () => {
    await request(serverOf(app)).post('/auth/logout').expect(204);
    await request(serverOf(app)).post('/auth/refresh').expect(401);
    await request(serverOf(app)).get('/faq-example').expect(200);
  });
});

describe('orden de los guards (R13)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({
      withFailures: false,
      config: { RATE_LIMIT_MAX_REQUESTS: 2, RATE_LIMIT_WINDOW_SECONDS: 60 },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 429 antes que 401 en un endpoint con rol', async () => {
    await request(serverOf(app)).get('/users').expect(401);
    await request(serverOf(app)).get('/users').expect(401);

    const res = await request(serverOf(app)).get('/users').expect(429);

    expect(apiErrorBodySchema.parse(res.body).code).toBe(ApiErrorCode.TooManyRequests);
  });
});

describe('verificación de declaración al arrancar (R2)', () => {
  @Controller('sin-declaracion')
  class UndeclaredController {
    @Get()
    list(): string {
      return 'no debe ejecutarse';
    }
  }

  it('impide arrancar la API y nombra el controlador y el método', async () => {
    const testing = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [UndeclaredController],
    }).compile();
    const undeclared = testing.createNestApplication();
    configureApp(undeclared);

    try {
      await expect(undeclared.init()).rejects.toThrow('UndeclaredController.list');
    } finally {
      await undeclared.close();
    }
  });
});
