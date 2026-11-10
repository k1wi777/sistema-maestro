import type { INestApplication } from '@nestjs/common';
import { TrainingActivityType, UserRole, type TeacherModule } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { createTestUser, signIn, type Cookies } from './support/session';
import {
  buildModule,
  call,
  milestonesOf,
  setupCourse,
  type Course,
  type ModuleOptions,
} from './support/training';

describe('progreso del docente en los módulos (BE-7)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let coord: Cookies;

  const mark = (course: Course, moduleId: string, what: 'video' | 'presentation') =>
    call(app, course.teacher, 'post', `/me/training/modules/${moduleId}/${what}-viewed`);
  const progressRow = (course: Course, moduleId: string) =>
    prisma.moduleProgress.findUnique({
      where: { teacherId_moduleId: { teacherId: course.user.id, moduleId } },
    });
  const moduleView = async (course: Course, moduleId: string) =>
    (await call(app, course.teacher, 'get', `/me/training/modules/${moduleId}`).expect(200))
      .body as TeacherModule;
  const activityIdOf = async (moduleId: string, type: TrainingActivityType) =>
    (await prisma.trainingActivity.findFirstOrThrow({ where: { moduleId, type } })).id;

  async function course(options: ModuleOptions = {}) {
    const base = await setupCourse(app, planning, coord);
    const module = await buildModule(app, coord, base.section.id, options);
    return { ...base, moduleId: module.id };
  }

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    coord = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  describe('video y presentación (R19)', () => {
    it('guarda la fecha de la primera marca y la conserva en las repetidas', async () => {
      const c = await course({ video: true, slides: 1 });

      const first = await mark(c, c.moduleId, 'video').expect(200);
      const again = await mark(c, c.moduleId, 'video').expect(200);

      expect((first.body as { viewedAt: string }).viewedAt).toBe(
        (again.body as { viewedAt: string }).viewedAt,
      );
      expect((await progressRow(c, c.moduleId))?.videoViewedAt?.toISOString()).toBe(
        (first.body as { viewedAt: string }).viewedAt,
      );
      expect(await milestonesOf(app, c.user.id)).toEqual(['Vio el video']);
    });

    it('responde 409 si el módulo no tiene ese paso', async () => {
      const c = await course({
        video: false,
        slides: 0,
        questions: [],
        activities: [{ type: TrainingActivityType.Simulator }],
      });

      await mark(c, c.moduleId, 'video').expect(409);
      await mark(c, c.moduleId, 'presentation').expect(409);
      expect(await progressRow(c, c.moduleId)).toBeNull();
    });

    it('marca la presentación con diapositivas y conserva su fecha', async () => {
      const c = await course({ video: true, slides: 2 });

      const first = await mark(c, c.moduleId, 'presentation').expect(200);
      const again = await mark(c, c.moduleId, 'presentation').expect(200);

      expect((first.body as { viewedAt: string }).viewedAt).toBe(
        (again.body as { viewedAt: string }).viewedAt,
      );
      expect(await milestonesOf(app, c.user.id)).toEqual(['Revisó la presentación']);
    });

    it('dos marcas simultáneas dejan una sola fecha y un solo hito (R28)', async () => {
      const c = await course({ video: true });

      const results = await Promise.all([1, 2, 3].map(() => mark(c, c.moduleId, 'video')));

      expect(results.map((res) => res.status)).toEqual([200, 200, 200]);
      const dates = new Set(results.map((res) => (res.body as { viewedAt: string }).viewedAt));
      expect(dates.size).toBe(1);
      // El video es el único paso: la terminación también ocurre una sola vez.
      expect(await milestonesOf(app, c.user.id)).toEqual(['Vio el video', 'Terminó un módulo']);
      expect(await prisma.moduleProgress.count({ where: { teacherId: c.user.id } })).toBe(1);
    });
  });

  describe('ruleta (R20)', () => {
    const stamp = (c: Course, activityId: string, cardKey: string, optionIndex: number) =>
      call(app, c.teacher, 'post', `/me/training/activities/${activityId}/stamps`).send({
        cardKey,
        optionIndex,
      });

    it('suma el sello solo con la respuesta correcta y completa con todos', async () => {
      const c = await course({
        video: false,
        activities: [{ type: TrainingActivityType.WheelPassport, isRequired: true }],
      });
      const activityId = await activityIdOf(c.moduleId, TrainingActivityType.WheelPassport);

      const wrong = await stamp(c, activityId, 'uno', 0).expect(200);
      expect(wrong.body).toMatchObject({
        correct: false,
        correctIndex: 1,
        stamps: [],
        completedAt: null,
      });
      const right = await stamp(c, activityId, 'uno', 1).expect(200);
      expect(right.body).toMatchObject({ correct: true, stamps: ['uno'], completedAt: null });
      const repeated = await stamp(c, activityId, 'uno', 1).expect(200);
      expect(repeated.body).toMatchObject({ stamps: ['uno'] });
      const last = await stamp(c, activityId, 'dos', 1).expect(200);

      expect((last.body as { stamps: string[] }).stamps).toEqual(['uno', 'dos']);
      expect((last.body as { completedAt: string | null }).completedAt).not.toBeNull();
      const row = await prisma.activityProgress.findFirstOrThrow({
        where: { teacherId: c.user.id, activityId },
      });
      expect(row.detail).toEqual({ sellos: ['uno', 'dos'] });
      expect(row.attempts).toBe(2);
      // Solo el sello que completa la ruleta llega a la bitácora.
      expect(await milestonesOf(app, c.user.id)).toEqual([
        'Completó una actividad',
        'Terminó un módulo',
      ]);
    });

    it('dos sellos iguales en paralelo dejan un solo sello (R28)', async () => {
      const c = await course({
        video: false,
        activities: [{ type: TrainingActivityType.WheelPassport }],
      });
      const activityId = await activityIdOf(c.moduleId, TrainingActivityType.WheelPassport);

      const results = await Promise.all([1, 2, 3].map(() => stamp(c, activityId, 'uno', 1)));

      expect(results.map((res) => res.status)).toEqual([200, 200, 200]);
      const row = await prisma.activityProgress.findFirstOrThrow({
        where: { teacherId: c.user.id, activityId },
      });
      expect(row.detail).toEqual({ sellos: ['uno'] });
      expect(row.attempts).toBe(1);
    });

    it('rechaza una tarjeta desconocida, una opción fuera de rango y otro tipo de actividad', async () => {
      const c = await course({
        video: false,
        activities: [
          { type: TrainingActivityType.WheelPassport },
          { type: TrainingActivityType.Simulator },
        ],
      });
      const wheel = await activityIdOf(c.moduleId, TrainingActivityType.WheelPassport);
      const simulator = await activityIdOf(c.moduleId, TrainingActivityType.Simulator);

      await stamp(c, wheel, 'no_existe', 0).expect(404);
      await stamp(c, wheel, 'uno', 3).expect(400);
      await stamp(c, simulator, 'uno', 0).expect(409);
    });
  });

  describe('simulador (R21)', () => {
    it('registra el uso y el primer uso sin aceptar valores', async () => {
      const c = await course({
        video: false,
        activities: [{ type: TrainingActivityType.Simulator }],
      });
      const activityId = await activityIdOf(c.moduleId, TrainingActivityType.Simulator);
      const use = (body: object = {}) =>
        call(app, c.teacher, 'post', `/me/training/activities/${activityId}/use`).send(body);

      await use({ salario: 3_000_000 }).expect(400);
      await use({ valores: { salario: 1 } }).expect(400);
      expect(
        await prisma.activityProgress.count({ where: { teacherId: c.user.id, activityId } }),
      ).toBe(0);

      const first = await use().expect(200);
      const second = await use().expect(200);

      expect(first.body).toMatchObject({ attempts: 1 });
      expect(second.body).toMatchObject({ attempts: 2 });
      expect((second.body as { completedAt: string }).completedAt).toBe(
        (first.body as { completedAt: string }).completedAt,
      );
      const row = await prisma.activityProgress.findFirstOrThrow({
        where: { teacherId: c.user.id, activityId },
      });
      expect(row.detail).toBeNull();
      expect(JSON.stringify(row)).not.toContain('3000000');
      expect(await milestonesOf(app, c.user.id)).toEqual([
        'Completó una actividad',
        'Terminó un módulo',
      ]);
    });
  });

  describe('terminación del módulo (R27)', () => {
    it('fija terminado_en una sola vez al cumplirse todos los pasos', async () => {
      const c = await course({
        video: true,
        slides: 1,
        activities: [{ type: TrainingActivityType.Simulator, isRequired: true }],
      });
      const activityId = await activityIdOf(c.moduleId, TrainingActivityType.Simulator);

      await mark(c, c.moduleId, 'video').expect(200);
      await mark(c, c.moduleId, 'presentation').expect(200);
      expect((await progressRow(c, c.moduleId))?.completedAt).toBeNull();
      await call(app, c.teacher, 'post', `/me/training/activities/${activityId}/use`)
        .send({})
        .expect(200);

      const done = await progressRow(c, c.moduleId);
      expect(done?.completedAt).not.toBeNull();
      expect((await moduleView(c, c.moduleId)).state).toBe('terminado');

      await mark(c, c.moduleId, 'video').expect(200);
      await call(app, c.teacher, 'post', `/me/training/activities/${activityId}/use`)
        .send({})
        .expect(200);
      expect((await progressRow(c, c.moduleId))?.completedAt?.toISOString()).toBe(
        done?.completedAt?.toISOString(),
      );
      expect(
        (await milestonesOf(app, c.user.id)).filter((a) => a === 'Terminó un módulo'),
      ).toHaveLength(1);
    });

    it('una marca repetida recoge el requisito que coordinación quitó', async () => {
      const c = await course({
        video: true,
        activities: [{ type: TrainingActivityType.Simulator, isRequired: true }],
      });
      const activityId = await activityIdOf(c.moduleId, TrainingActivityType.Simulator);
      await mark(c, c.moduleId, 'video').expect(200);
      expect((await progressRow(c, c.moduleId))?.completedAt).toBeNull();

      await call(
        app,
        coord,
        'post',
        `/training-modules/${c.moduleId}/activities/${activityId}/withdraw`,
      ).expect(200);
      await mark(c, c.moduleId, 'video').expect(200);

      expect((await progressRow(c, c.moduleId))?.completedAt).not.toBeNull();
    });

    it('una actividad opcional no impide terminar y un módulo sin pasos de docente no termina solo', async () => {
      const c = await course({
        video: true,
        activities: [{ type: TrainingActivityType.Simulator, isRequired: false }],
      });

      await mark(c, c.moduleId, 'video').expect(200);

      expect((await progressRow(c, c.moduleId))?.completedAt).not.toBeNull();
    });
  });
});
