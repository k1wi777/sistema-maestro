import { randomUUID } from 'node:crypto';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { apiErrorBodySchema, ApiErrorCode, UserRole } from '@gns/shared';
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
  /** `public` o el conjunto exacto de roles permitidos (sin jerarquía). */
  access: 'public' | UserRole[];
}

const PUBLIC = 'public' as const;
const TEACHER = UserRole.Teacher;
const COORD = UserRole.Coordinator;
const ADMIN = UserRole.Administrator;

const T_ONLY = [TEACHER];
const C_ONLY = [COORD];
const A_ONLY = [ADMIN];
const CA = [COORD, ADMIN];
const TC = [TEACHER, COORD];
const TCA = [TEACHER, COORD, ADMIN];

/** Mismo formato (orden fijo) que `AccessDeclarationVerifier.listRoutes()`. */
const accessLabel = (access: 'public' | UserRole[]) =>
  access === PUBLIC ? 'public' : TCA.filter((role) => access.includes(role)).join(',');

// Matriz esperada de TODAS las rutas (incluidas las de prueba). Una ruta nueva, o una cuyo
// acceso cambia, hace fallar la prueba de inventario hasta que se actualice aquí (R6).
const EXPECTED_ROUTES: ExpectedRoute[] = [
  { method: 'post', path: '/auth/login', access: PUBLIC },
  { method: 'post', path: '/auth/refresh', access: PUBLIC },
  { method: 'post', path: '/auth/logout', access: PUBLIC },
  { method: 'get', path: '/auth/me', access: TCA },
  { method: 'put', path: '/auth/password', access: TCA },
  { method: 'get', path: '/consent', access: TCA },
  { method: 'post', path: '/consent', access: TCA },
  { method: 'get', path: '/users', access: A_ONLY },
  { method: 'get', path: '/users/:id', access: A_ONLY },
  { method: 'post', path: '/users', access: A_ONLY },
  { method: 'patch', path: '/users/:id', access: A_ONLY },
  { method: 'patch', path: '/users/:id/status', access: A_ONLY },
  { method: 'put', path: '/users/:id/password', access: A_ONLY },
  { method: 'put', path: '/users/:id/role', access: A_ONLY },
  { method: 'get', path: '/levels', access: TCA },
  { method: 'post', path: '/levels', access: A_ONLY },
  { method: 'patch', path: '/levels/:id', access: A_ONLY },
  { method: 'get', path: '/grades', access: TCA },
  { method: 'post', path: '/grades', access: A_ONLY },
  { method: 'patch', path: '/grades/:id', access: A_ONLY },
  { method: 'delete', path: '/grades/:id', access: A_ONLY },
  { method: 'get', path: '/groups', access: TCA },
  { method: 'post', path: '/groups', access: A_ONLY },
  { method: 'patch', path: '/groups/:id', access: A_ONLY },
  { method: 'delete', path: '/groups/:id', access: A_ONLY },
  { method: 'get', path: '/academic-structure', access: A_ONLY },
  { method: 'put', path: '/coordinators/:id/grades', access: A_ONLY },
  { method: 'get', path: '/areas', access: TCA },
  { method: 'post', path: '/areas', access: A_ONLY },
  { method: 'patch', path: '/areas/:id', access: A_ONLY },
  { method: 'delete', path: '/areas/:id', access: A_ONLY },
  { method: 'get', path: '/academic-periods', access: TCA },
  { method: 'post', path: '/academic-periods', access: A_ONLY },
  { method: 'patch', path: '/academic-periods/:id', access: A_ONLY },
  { method: 'get', path: '/teacher-assignments', access: CA },
  { method: 'post', path: '/teacher-assignments', access: CA },
  { method: 'patch', path: '/teacher-assignments/:id', access: CA },
  { method: 'patch', path: '/teacher-assignments/:id/status', access: CA },
  { method: 'get', path: '/me/assignments', access: T_ONLY },
  { method: 'get', path: '/school-years', access: TCA },
  { method: 'get', path: '/school-years/current', access: TCA },
  { method: 'post', path: '/school-years', access: A_ONLY },
  { method: 'put', path: '/school-years/:id/current', access: A_ONLY },
  { method: 'get', path: '/lesson-plans', access: TCA },
  { method: 'get', path: '/lesson-plans/options', access: T_ONLY },
  { method: 'get', path: '/lesson-plans/:id', access: TCA },
  { method: 'post', path: '/lesson-plans', access: T_ONLY },
  { method: 'patch', path: '/lesson-plans/:id', access: T_ONLY },
  { method: 'post', path: '/lesson-plans/:id/submit', access: T_ONLY },
  { method: 'post', path: '/lesson-plans/:id/void', access: TC },
  { method: 'delete', path: '/lesson-plans/:id', access: T_ONLY },
  { method: 'post', path: '/lesson-plans/:id/resources', access: T_ONLY },
  { method: 'delete', path: '/lesson-plans/:id/resources/:resourceId', access: T_ONLY },
  { method: 'post', path: '/lesson-plans/:id/approve', access: C_ONLY },
  { method: 'post', path: '/lesson-plans/:id/return', access: C_ONLY },
  { method: 'get', path: '/lesson-plans/:id/reviews', access: TCA },
  { method: 'get', path: '/lesson-plan-compliance', access: CA },
  { method: 'get', path: '/field-journals', access: TCA },
  { method: 'get', path: '/field-journals/today', access: T_ONLY },
  { method: 'get', path: '/field-journals/review-scope', access: CA },
  { method: 'get', path: '/field-journals/day', access: T_ONLY },
  { method: 'get', path: '/field-journals/:id', access: TCA },
  { method: 'post', path: '/field-journals/annotations', access: T_ONLY },
  { method: 'delete', path: '/field-journals/annotations/:id', access: T_ONLY },
  { method: 'patch', path: '/field-journals/:id/annotations/:annotationId', access: T_ONLY },
  { method: 'post', path: '/field-journals/:id/annotations/:annotationId/ready', access: T_ONLY },
  { method: 'post', path: '/field-journals/:id/annotations/:annotationId/draft', access: T_ONLY },
  { method: 'post', path: '/field-journals/:id/submit', access: T_ONLY },
  { method: 'post', path: '/field-journals/:id/resubmit', access: T_ONLY },
  { method: 'post', path: '/field-journals/:id/void', access: T_ONLY },
  { method: 'post', path: '/field-journals/:id/approve', access: C_ONLY },
  { method: 'post', path: '/field-journals/:id/return', access: C_ONLY },
  { method: 'get', path: '/observer-notes', access: TCA },
  { method: 'get', path: '/observer-notes/:id', access: TCA },
  { method: 'post', path: '/observer-notes', access: T_ONLY },
  { method: 'patch', path: '/observer-notes/:id', access: T_ONLY },
  { method: 'post', path: '/observer-notes/:id/submit', access: T_ONLY },
  { method: 'post', path: '/observer-notes/:id/void', access: TC },
  { method: 'delete', path: '/observer-notes/:id', access: T_ONLY },
  { method: 'post', path: '/observer-notes/:id/approve', access: C_ONLY },
  { method: 'post', path: '/observer-notes/:id/return', access: C_ONLY },
  { method: 'get', path: '/observer-notes/:id/reviews', access: TCA },
  { method: 'get', path: '/shared-activities', access: T_ONLY },
  { method: 'get', path: '/shared-activities/learning-corners', access: T_ONLY },
  { method: 'get', path: '/shared-activities/:id', access: T_ONLY },
  { method: 'post', path: '/shared-activities', access: T_ONLY },
  { method: 'patch', path: '/shared-activities/:id', access: T_ONLY },
  { method: 'delete', path: '/shared-activities/:id', access: T_ONLY },
  { method: 'put', path: '/shared-activities/:id/favorite', access: T_ONLY },
  { method: 'delete', path: '/shared-activities/:id/favorite', access: T_ONLY },
  { method: 'get', path: '/training-plans', access: CA },
  { method: 'post', path: '/training-plans', access: CA },
  { method: 'patch', path: '/training-plans/:id', access: CA },
  { method: 'get', path: '/training-plans/:id/sections', access: CA },
  { method: 'post', path: '/training-plans/:id/sections', access: CA },
  { method: 'put', path: '/training-plans/:id/section-order', access: CA },
  { method: 'patch', path: '/training-sections/:id', access: CA },
  { method: 'delete', path: '/training-sections/:id', access: CA },
  { method: 'post', path: '/training-sections/:id/modules', access: CA },
  { method: 'put', path: '/training-sections/:id/module-order', access: CA },
  { method: 'get', path: '/training-modules/:id', access: CA },
  { method: 'patch', path: '/training-modules/:id', access: CA },
  { method: 'post', path: '/training-modules/:id/publish', access: CA },
  { method: 'post', path: '/training-modules/:id/withdraw', access: CA },
  { method: 'post', path: '/training-modules/:id/restore', access: CA },
  { method: 'post', path: '/training-modules/:id/slides', access: CA },
  { method: 'patch', path: '/training-modules/:id/slides/:slideId', access: CA },
  { method: 'delete', path: '/training-modules/:id/slides/:slideId', access: CA },
  { method: 'put', path: '/training-modules/:id/slide-order', access: CA },
  { method: 'post', path: '/training-modules/:id/questions', access: CA },
  { method: 'put', path: '/training-modules/:id/questions/:questionId', access: CA },
  { method: 'delete', path: '/training-modules/:id/questions/:questionId', access: CA },
  { method: 'put', path: '/training-modules/:id/question-order', access: CA },
  { method: 'post', path: '/training-modules/:id/activities', access: CA },
  { method: 'patch', path: '/training-modules/:id/activities/:activityId', access: CA },
  { method: 'post', path: '/training-modules/:id/activities/:activityId/withdraw', access: CA },
  { method: 'post', path: '/training-modules/:id/activities/:activityId/restore', access: CA },
  { method: 'put', path: '/training-modules/:id/activity-order', access: CA },
  { method: 'get', path: '/me/training/route', access: T_ONLY },
  { method: 'post', path: '/me/training/modules/:moduleId/files/:purpose/url', access: T_ONLY },
  { method: 'get', path: '/me/training/certificates', access: T_ONLY },
  { method: 'post', path: '/me/training/certificates/:id/download', access: T_ONLY },
  { method: 'post', path: '/training-modules/:id/files', access: CA },
  { method: 'post', path: '/training-modules/:id/files/:fileId/confirm', access: CA },
  { method: 'delete', path: '/training-modules/:id/files/:purpose', access: CA },
  { method: 'post', path: '/training-modules/:id/files/:purpose/url', access: CA },
  { method: 'get', path: '/training-certificates', access: CA },
  { method: 'post', path: '/training-certificates/:id/download', access: CA },
  { method: 'get', path: '/certificates/verify/:code', access: PUBLIC },
  { method: 'get', path: '/assistant/faqs', access: T_ONLY },
  { method: 'post', path: '/assistant/queries', access: T_ONLY },
  { method: 'get', path: '/faqs', access: CA },
  { method: 'get', path: '/faqs/:id', access: CA },
  { method: 'post', path: '/faqs', access: CA },
  { method: 'patch', path: '/faqs/:id', access: CA },
  { method: 'get', path: '/unanswered-questions', access: CA },
  { method: 'get', path: '/unanswered-questions/:id', access: CA },
  { method: 'post', path: '/unanswered-questions/:id/discard', access: CA },
  { method: 'get', path: '/audit-log', access: A_ONLY },
  { method: 'get', path: '/audit-log/export', access: A_ONLY },
  { method: 'get', path: '/audit-log/:id', access: A_ONLY },
  { method: 'get', path: '/training-tracking/plans/:planId', access: CA },
  { method: 'get', path: '/training-tracking/plans/:planId/export', access: CA },
  { method: 'get', path: '/training-tracking/teachers/:teacherId', access: CA },
  { method: 'get', path: '/me/training/modules/:moduleId', access: T_ONLY },
  { method: 'post', path: '/me/training/modules/:moduleId/video-viewed', access: T_ONLY },
  { method: 'post', path: '/me/training/modules/:moduleId/presentation-viewed', access: T_ONLY },
  { method: 'post', path: '/me/training/modules/:moduleId/challenge', access: T_ONLY },
  { method: 'post', path: '/me/training/modules/:moduleId/challenge/answer', access: T_ONLY },
  { method: 'post', path: '/me/training/modules/:moduleId/challenge/next', access: T_ONLY },
  { method: 'post', path: '/me/training/activities/:activityId/stamps', access: T_ONLY },
  { method: 'post', path: '/me/training/activities/:activityId/use', access: T_ONLY },
  { method: 'post', path: '/me/training/activities/:activityId/game', access: T_ONLY },
  { method: 'post', path: '/me/training/activities/:activityId/game/answer', access: T_ONLY },
  { method: 'post', path: '/me/training/activities/:activityId/game/next', access: T_ONLY },
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
    const expected = EXPECTED_ROUTES.map(
      (route) => `${label(route)} -> ${accessLabel(route.access)}`,
    ).sort();

    expect(actual).toEqual(expected);
  });

  describe.each(
    EXPECTED_ROUTES.filter(
      (route): route is ExpectedRoute & { access: UserRole[] } => route.access !== PUBLIC,
    ),
  )('$method $path', (route) => {
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

    // Los tres roles en cada ruta: los del conjunto pasan el guard y el resto recibe 403.
    it.each(TCA)('con el rol %s', async (role) => {
      const res = await call(sessions.get(role));

      if (route.access.includes(role)) {
        // Pasa el guard: lo que responda el endpoint (400 por el cuerpo vacío, 404...) no es 401 ni 403.
        expect([401, 403]).not.toContain(res.status);
      } else {
        expect(res.status).toBe(403);
        expect(apiErrorBodySchema.parse(res.body).code).toBe(ApiErrorCode.Forbidden);
      }
    });
  });

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
