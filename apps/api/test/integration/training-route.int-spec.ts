import type { INestApplication } from '@nestjs/common';
import {
  ApiErrorCode,
  TrainingActivityType,
  UserRole,
  type TeacherModule,
  type TeacherRoute,
} from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { createTestUser, signIn, type Cookies } from './support/session';
import {
  addActivity,
  addTeacher,
  buildModule,
  call,
  createModule,
  createSection,
  keysMatching,
  OPTION_QUESTION,
  ORDERING_QUESTION,
  setupCourse,
  SOLUTION_KEYS,
  TRUE_FALSE_QUESTION,
  type Course,
} from './support/training';

const SECRET_TEXTS = [
  'Dato de A',
  'Dato de B',
  'Afirmación uno',
  'Explicación uno',
  'Era la primera.',
  'La correcta',
  'Primero',
];

describe('ruta y módulo del docente (BE-7)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let coord: Cookies;
  let generalModuleId: string;

  const route = async (cookies: Cookies) =>
    (await call(app, cookies, 'get', '/me/training/route').expect(200)).body as TeacherRoute;
  const view = (cookies: Cookies, moduleId: string) =>
    call(app, cookies, 'get', `/me/training/modules/${moduleId}`);

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    coord = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));

    // Plan General de la prueba: solo este archivo lo crea para el año vigente.
    const general = await prisma.trainingPlan.create({
      data: { name: 'Inducción de prueba', schoolYear: planning.year },
    });
    const welcome = await prisma.trainingSection.create({
      data: { planId: general.id, title: 'Bienvenida de prueba', sortOrder: 1 },
    });
    const module = await prisma.trainingModule.create({
      data: {
        planId: general.id,
        sectionId: welcome.id,
        sortOrder: 1,
        title: 'Módulo general de prueba',
        status: 'activo',
      },
    });
    generalModuleId = module.id;
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  async function populatedCourse(): Promise<
    Course & { first: string; second: string; emptyId: string }
  > {
    const course = await setupCourse(app, planning, coord);
    const empty = await createSection(app, coord, course.plan.id, 'Sección sin módulos activos');
    await createModule(app, coord, empty.id, { videoUrl: 'https://youtu.be/abcdefghijk' });
    const second = await createSection(app, coord, course.plan.id, 'Segunda');
    const a = await buildModule(app, coord, course.section.id, {
      video: true,
      slides: 1,
      questions: [OPTION_QUESTION, TRUE_FALSE_QUESTION],
      activities: [{ type: TrainingActivityType.Match, isRequired: true }],
    });
    const b = await buildModule(app, coord, second.id, { video: true });
    return { ...course, first: a.id, second: b.id, emptyId: empty.id };
  }

  it('agrupa plan, sección y módulo en orden, solo con los activos, y General primero (R15)', async () => {
    const course = await populatedCourse();

    const body = await route(course.teacher);

    expect(body.plans.map((plan) => plan.areaId)).toEqual([null, course.areaId]);
    const own = body.plans[1];
    expect(own?.sections.map((section) => section.title)).toEqual(['Sección del curso', 'Segunda']);
    expect(own?.sections.map((section) => section.modules.map((module) => module.id))).toEqual([
      [course.first],
      [course.second],
    ]);
    expect(own?.totals).toEqual({ modules: 2, completed: 0 });
    expect(own?.sections[0]?.modules[0]).toMatchObject({
      state: 'pendiente',
      steps: { video: true, presentation: true, challenge: true, activities: 1 },
    });
    expect(
      body.plans[0]?.sections.flatMap((section) => section.modules.map((m) => m.id)),
    ).toContain(generalModuleId);
  });

  it('omite las secciones sin módulos activos y los módulos fuera del plan', async () => {
    const course = await populatedCourse();
    await call(app, coord, 'post', `/training-modules/${course.second}/withdraw`).expect(200);

    const own = (await route(course.teacher)).plans.find((plan) => plan.areaId === course.areaId);

    expect(own?.sections.map((section) => section.title)).toEqual(['Sección del curso']);
  });

  it('muestra el módulo movido en su nueva sección con su progreso', async () => {
    const course = await populatedCourse();
    await call(
      app,
      course.teacher,
      'post',
      `/me/training/modules/${course.first}/video-viewed`,
    ).expect(200);
    await call(app, coord, 'patch', `/training-modules/${course.first}`)
      .send({ sectionId: (await createSection(app, coord, course.plan.id, 'Nueva')).id })
      .expect(200);

    const own = (await route(course.teacher)).plans.find((plan) => plan.areaId === course.areaId);

    const moved = own?.sections.find((section) => section.title === 'Nueva')?.modules[0];
    expect(moved).toMatchObject({ id: course.first, state: 'en_curso' });
  });

  it('un docente sin asignaciones activas ve solo planes General (R16)', async () => {
    const course = await populatedCourse();
    const loner = await signIn(app, await createTestUser(app));
    const retired = await createTestUser(app);
    const { gradeId } = await prisma.teacherAssignment.findFirstOrThrow({
      where: { teacherId: course.user.id },
    });
    await planning.assign(retired.id, gradeId, course.areaId, 'retirada');

    for (const cookies of [loner, await signIn(app, retired)]) {
      const body = await route(cookies);
      const modules = body.plans.flatMap((plan) =>
        plan.sections.flatMap((s) => s.modules.map((m) => m.id)),
      );
      expect(body.plans.every((plan) => plan.areaId === null)).toBe(true);
      expect(modules).toContain(generalModuleId);
      expect(modules).not.toContain(course.first);
    }
  });

  it('responde 404 sin revelar nada para lo que no está en la ruta (R17)', async () => {
    const course = await populatedCourse();
    const other = await populatedCourse();
    const draft = await buildModule(app, coord, course.section.id, { video: true, publish: false });
    const outOfPlan = await buildModule(app, coord, course.section.id, { video: true });
    await call(app, coord, 'post', `/training-modules/${outOfPlan.id}/withdraw`).expect(200);
    const foreignActivity = await addActivity(
      app,
      coord,
      other.first,
      TrainingActivityType.Simulator,
    );
    const ownActivity = await addActivity(app, coord, course.first, TrainingActivityType.Simulator);
    await call(
      app,
      coord,
      'post',
      `/training-modules/${course.first}/activities/${ownActivity.id}/withdraw`,
    ).expect(200);

    for (const moduleId of [
      draft.id,
      outOfPlan.id,
      other.first,
      '00000000-0000-4000-8000-000000000001',
    ]) {
      const res = await view(course.teacher, moduleId).expect(404);
      expect(JSON.stringify(res.body)).not.toMatch(/Módulo [0-9a-f]{8}|youtu/);
      await call(
        app,
        course.teacher,
        'post',
        `/me/training/modules/${moduleId}/video-viewed`,
      ).expect(404);
      await call(app, course.teacher, 'post', `/me/training/modules/${moduleId}/challenge`).expect(
        404,
      );
    }
    for (const activityId of [foreignActivity.id, ownActivity.id]) {
      await call(app, course.teacher, 'post', `/me/training/activities/${activityId}/use`)
        .send({})
        .expect(404);
      await call(app, course.teacher, 'post', `/me/training/activities/${activityId}/game`).expect(
        404,
      );
    }
  });

  it('no entrega ninguna solución ni retroalimentación en la ruta ni en el módulo (R18)', async () => {
    const course = await setupCourse(app, planning, coord);
    const module = await buildModule(app, coord, course.section.id, {
      video: true,
      slides: 1,
      questions: [OPTION_QUESTION, TRUE_FALSE_QUESTION, ORDERING_QUESTION],
      activities: [
        { type: TrainingActivityType.WheelPassport },
        { type: TrainingActivityType.Match },
        { type: TrainingActivityType.TrueOrMyth },
        { type: TrainingActivityType.Simulator },
      ],
    });

    const detail = (await view(course.teacher, module.id).expect(200)).body as TeacherModule;
    const summary = await route(course.teacher);

    for (const body of [detail, summary]) {
      expect(keysMatching(body, SOLUTION_KEYS)).toEqual([]);
      const text = JSON.stringify(body);
      for (const secret of SECRET_TEXTS) {
        expect([secret, text.includes(secret)]).toEqual([secret, false]);
      }
    }
    expect(detail.activities.map((activity) => activity.type)).toEqual([
      'ruleta_pasaporte',
      'conecta',
      'verdad_o_mito',
      'simulador',
    ]);
    expect(detail.challenge).toMatchObject({ questionCount: 3, approvalThreshold: 80 });
    expect(detail.section.title).toBe('Sección del curso');
  });

  it('no expone el progreso de otro docente', async () => {
    const course = await populatedCourse();
    const colleague = await addTeacher(app, planning, course);
    await call(
      app,
      colleague.cookies,
      'post',
      `/me/training/modules/${course.first}/video-viewed`,
    ).expect(200);

    const mine = (await view(course.teacher, course.first).expect(200)).body as TeacherModule;
    const theirs = (await view(colleague.cookies, course.first).expect(200)).body as TeacherModule;

    expect(mine.progress.videoViewedAt).toBeNull();
    expect(theirs.progress.videoViewedAt).not.toBeNull();
    expect(mine.state).toBe('pendiente');
    expect(theirs.state).toBe('en_curso');
  });

  it('exige el aviso de datos aceptado y el rol docente o superior', async () => {
    const withoutConsent = await signIn(app, await createTestUser(app, { consent: false }));

    const res = await call(app, withoutConsent, 'get', '/me/training/route').expect(403);

    expect((res.body as { code: string }).code).toBe(ApiErrorCode.ConsentRequired);
    await call(app, coord, 'get', '/me/training/route').expect(200);
  });
});
