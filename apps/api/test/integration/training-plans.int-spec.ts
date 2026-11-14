import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { UserRole, type TrainingPlanTree } from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { createTestUser, signIn, type Cookies } from './support/session';
import {
  addSlide,
  buildModule,
  call,
  createAreaPlan,
  createModule,
  createSection,
  publish,
  trainingAudit,
  unique,
} from './support/training';

describe('planes, secciones y módulos de formación (BE-7)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let coord: Cookies;
  let admin: Cookies;
  let teacher: Cookies;

  const newArea = async () => (await planning.gradeAndArea('Primaria')).areaId;
  const tree = async (planId: string) =>
    (await call(app, coord, 'get', `/training-plans/${planId}/sections`).expect(200))
      .body as TrainingPlanTree;
  /** Año lectivo propio de la prueba, no vigente: allí un plan General no choca con otros archivos. */
  const ownYear = async (): Promise<string> => {
    const start = randomInt(3000, 8999);
    const code = `${start}-${start + 1}`;
    await prisma.schoolYear.createMany({ data: [{ code }], skipDuplicates: true });
    return code;
  };

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    coord = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
    admin = await signIn(app, await createTestUser(app, { role: UserRole.Administrator }));
    teacher = await signIn(app, await createTestUser(app));
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  describe('planes (R1)', () => {
    it('crea un plan de un área, lo lista con sus conteos y lo edita sin cambiar el área', async () => {
      const areaId = await newArea();
      const plan = await createAreaPlan(app, coord, planning, areaId, 'Plan de prueba');

      const list = await call(app, coord, 'get', '/training-plans').expect(200);
      const found = (
        list.body as { items: { id: string; areaId: string; moduleCounts: object }[] }
      ).items.find((item) => item.id === plan.id);
      expect(found).toMatchObject({ areaId, moduleCounts: { draft: 0, active: 0, outOfPlan: 0 } });

      const edited = await call(app, coord, 'patch', `/training-plans/${plan.id}`)
        .send({ name: 'Plan editado' })
        .expect(200);
      expect(edited.body).toMatchObject({ name: 'Plan editado', areaId });
      await call(app, coord, 'patch', `/training-plans/${plan.id}`)
        .send({ areaId: await newArea() })
        .expect(400);
    });

    it('responde 409 a un segundo plan de la misma área y año, también en paralelo', async () => {
      const areaId = await newArea();
      const year = planning.year;

      const results = await Promise.all(
        [1, 2, 3].map(() =>
          call(app, coord, 'post', '/training-plans').send({
            name: 'Doble',
            areaId,
            schoolYear: year,
          }),
        ),
      );

      expect(results.map((res) => res.status).sort()).toEqual([201, 409, 409]);
      expect(await prisma.trainingPlan.count({ where: { areaId, schoolYear: year } })).toBe(1);
    });

    it('permite un plan General por año y responde 409 al repetirlo o al mover otro a ese año', async () => {
      const year = await ownYear();
      const other = await ownYear();
      const general = await call(app, coord, 'post', '/training-plans')
        .send({ name: 'General', schoolYear: year })
        .expect(201);
      expect(general.body).toMatchObject({ areaId: null, schoolYear: year });

      await call(app, coord, 'post', '/training-plans')
        .send({ name: 'General bis', schoolYear: year })
        .expect(409);
      const second = await call(app, coord, 'post', '/training-plans')
        .send({ name: 'General 2', schoolYear: other })
        .expect(201);
      await call(app, coord, 'patch', `/training-plans/${(second.body as { id: string }).id}`)
        .send({ schoolYear: year })
        .expect(409);
    });

    it('responde 400 a un área o año inexistente y 404 a un plan que no existe', async () => {
      await call(app, coord, 'post', '/training-plans')
        .send({ name: 'x', areaId: '00000000-0000-4000-8000-000000000001' })
        .expect(400);
      await call(app, coord, 'post', '/training-plans')
        .send({ name: 'x', schoolYear: '1999-2000' })
        .expect(400);
      await call(
        app,
        coord,
        'get',
        '/training-plans/00000000-0000-4000-8000-000000000001/sections',
      ).expect(404);
    });
  });

  describe('secciones (R2, R7)', () => {
    it('crea secciones al final, las edita y quita solo las vacías', async () => {
      const plan = await createAreaPlan(app, coord, planning, await newArea());
      const first = await createSection(app, coord, plan.id, 'Parte I');
      const second = await createSection(app, coord, plan.id, 'Parte II');
      expect([first.sortOrder, second.sortOrder]).toEqual([1, 2]);

      await call(app, coord, 'patch', `/training-sections/${first.id}`)
        .send({ title: 'Parte uno', subtitle: 'Subtítulo' })
        .expect(200);
      const module = await createModule(app, coord, first.id);
      await call(app, coord, 'delete', `/training-sections/${first.id}`).expect(409);
      expect(await prisma.trainingSection.count({ where: { id: first.id } })).toBe(1);

      await call(app, coord, 'delete', `/training-sections/${second.id}`).expect(204);
      expect((await tree(plan.id)).sections.map((section) => section.title)).toEqual(['Parte uno']);
      expect((await tree(plan.id)).sections[0]?.modules.map((m) => m.id)).toEqual([module.id]);
    });

    it('reordena con la lista completa y responde 409 sin cambiar nada si no coincide', async () => {
      const plan = await createAreaPlan(app, coord, planning, await newArea());
      const [a, b, c] = [
        await createSection(app, coord, plan.id, 'A'),
        await createSection(app, coord, plan.id, 'B'),
        await createSection(app, coord, plan.id, 'C'),
      ];

      await call(app, coord, 'put', `/training-plans/${plan.id}/section-order`)
        .send({ ids: [c.id, a.id, b.id] })
        .expect(200);
      expect((await tree(plan.id)).sections.map((s) => s.title)).toEqual(['C', 'A', 'B']);

      await call(app, coord, 'put', `/training-plans/${plan.id}/section-order`)
        .send({ ids: [a.id, b.id] })
        .expect(409);
      await call(app, coord, 'put', `/training-plans/${plan.id}/section-order`)
        .send({ ids: [a.id, a.id, b.id] })
        .expect(400);
      await call(app, coord, 'put', `/training-plans/${plan.id}/section-order`)
        .send({ ids: [a.id, b.id, '00000000-0000-4000-8000-000000000009'] })
        .expect(409);
      expect((await tree(plan.id)).sections.map((s) => s.title)).toEqual(['C', 'A', 'B']);
    });

    it('un alta simultánea hace fallar con 409 el orden que no la incluye', async () => {
      const plan = await createAreaPlan(app, coord, planning, await newArea());
      const a = await createSection(app, coord, plan.id, 'A');
      const b = await createSection(app, coord, plan.id, 'B');

      const [order, added] = await Promise.all([
        call(app, coord, 'put', `/training-plans/${plan.id}/section-order`).send({
          ids: [b.id, a.id],
        }),
        call(app, coord, 'post', `/training-plans/${plan.id}/sections`).send({ title: 'Nueva' }),
      ]);

      expect(added.status).toBe(201);
      // Según quién tome primero el candado del plan, el orden se aplica o falla sin efecto.
      expect([200, 409]).toContain(order.status);
      const titles = (await tree(plan.id)).sections.map((s) => s.title);
      expect(titles).toHaveLength(3);
      if (order.status === 409) {
        expect(titles).toEqual(['A', 'B', 'Nueva']);
      }
    });
  });

  describe('módulos (R3 a R8)', () => {
    it('crea el módulo en borrador al final de la sección y lo valida', async () => {
      const plan = await createAreaPlan(app, coord, planning, await newArea());
      const section = await createSection(app, coord, plan.id);

      const first = await createModule(app, coord, section.id, { number: '1', summary: 'Resumen' });
      const second = await createModule(app, coord, section.id, { approvalThreshold: 70 });
      expect(first).toMatchObject({
        status: 'borrador',
        sortOrder: 1,
        sectionId: section.id,
        approvalThreshold: 80,
      });
      expect(second).toMatchObject({ sortOrder: 2, approvalThreshold: 70 });

      await call(app, coord, 'post', `/training-sections/${section.id}/modules`)
        .send({ title: 'x', videoUrl: 'http://inseguro.test' })
        .expect(400);
      await call(app, coord, 'post', `/training-sections/${section.id}/modules`)
        .send({ title: 'x', secondsPerQuestion: 2 })
        .expect(400);
    });

    it('mueve un módulo al final de otra sección del mismo plan y responde 400 si es de otro plan', async () => {
      const plan = await createAreaPlan(app, coord, planning, await newArea());
      const other = await createAreaPlan(app, coord, planning, await newArea());
      const from = await createSection(app, coord, plan.id, 'Origen');
      const to = await createSection(app, coord, plan.id, 'Destino');
      const foreign = await createSection(app, coord, other.id, 'Ajena');
      const moving = await createModule(app, coord, from.id);
      const resident = await createModule(app, coord, to.id);

      const moved = await call(app, coord, 'patch', `/training-modules/${moving.id}`)
        .send({ sectionId: to.id, title: 'Movido' })
        .expect(200);
      expect(moved.body).toMatchObject({ sectionId: to.id, sortOrder: 2, title: 'Movido' });
      expect(resident.sortOrder).toBe(1);

      await call(app, coord, 'patch', `/training-modules/${moving.id}`)
        .send({ sectionId: foreign.id })
        .expect(400);
      expect(
        (await prisma.trainingModule.findUniqueOrThrow({ where: { id: moving.id } })).sectionId,
      ).toBe(to.id);
    });

    it('reordena los módulos de una sección y las diapositivas de un módulo con 409 si no coincide', async () => {
      const plan = await createAreaPlan(app, coord, planning, await newArea());
      const section = await createSection(app, coord, plan.id);
      const a = await createModule(app, coord, section.id);
      const b = await createModule(app, coord, section.id);

      await call(app, coord, 'put', `/training-sections/${section.id}/module-order`)
        .send({ ids: [b.id, a.id] })
        .expect(200);
      expect(
        (await tree(plan.id)).sections[0]?.modules.map((module) => [module.id, module.sortOrder]),
      ).toEqual([
        [b.id, 1],
        [a.id, 2],
      ]);
      await call(app, coord, 'put', `/training-sections/${section.id}/module-order`)
        .send({ ids: [b.id] })
        .expect(409);

      const slide1 = await addSlide(app, coord, a.id, 'Uno');
      const slide2 = await addSlide(app, coord, a.id, 'Dos');
      await call(app, coord, 'put', `/training-modules/${a.id}/slide-order`)
        .send({ ids: [slide2.id, slide1.id] })
        .expect(200);
      await call(app, coord, 'put', `/training-modules/${a.id}/slide-order`)
        .send({ ids: [slide2.id] })
        .expect(409);
      const detail = await call(app, coord, 'get', `/training-modules/${a.id}`).expect(200);
      expect((detail.body as { slides: { title: string }[] }).slides.map((s) => s.title)).toEqual([
        'Dos',
        'Uno',
      ]);
    });

    it('aplica solo las transiciones permitidas y responde 409 a las demás', async () => {
      const plan = await createAreaPlan(app, coord, planning, await newArea());
      const section = await createSection(app, coord, plan.id);
      const module = await createModule(app, coord, section.id, {
        videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
      });
      const state = (action: string) =>
        call(app, coord, 'post', `/training-modules/${module.id}/${action}`);

      await state('withdraw').expect(409);
      await state('restore').expect(409);
      expect((await state('publish').expect(200)).body).toMatchObject({ status: 'activo' });
      await state('publish').expect(409);
      expect((await state('withdraw').expect(200)).body).toMatchObject({
        status: 'fuera_del_plan',
      });
      await state('withdraw').expect(409);
      await state('publish').expect(409);
      expect((await state('restore').expect(200)).body).toMatchObject({ status: 'activo' });
    });

    it('no publica un módulo sin ningún paso exigible', async () => {
      const plan = await createAreaPlan(app, coord, planning, await newArea());
      const section = await createSection(app, coord, plan.id);
      const empty = await createModule(app, coord, section.id);

      await call(app, coord, 'post', `/training-modules/${empty.id}/publish`).expect(409);
      await addSlide(app, coord, empty.id);
      await publish(app, coord, empty.id);
    });

    it('conserva el progreso del docente al sacar, restaurar, editar y mover el módulo (R8)', async () => {
      const plan = await createAreaPlan(app, coord, planning, await newArea());
      const from = await createSection(app, coord, plan.id, 'Origen');
      const to = await createSection(app, coord, plan.id, 'Destino');
      const module = await buildModule(app, coord, from.id, { video: true });
      const teacherUser = await createTestUser(app);
      const viewed = new Date('2026-01-02T03:04:05.000Z');
      await prisma.moduleProgress.create({
        data: {
          teacherId: teacherUser.id,
          moduleId: module.id,
          videoViewedAt: viewed,
          bestScore: 90,
        },
      });

      await call(app, coord, 'post', `/training-modules/${module.id}/withdraw`).expect(200);
      await call(app, coord, 'post', `/training-modules/${module.id}/restore`).expect(200);
      await call(app, coord, 'patch', `/training-modules/${module.id}`)
        .send({ title: 'Editado' })
        .expect(200);
      await call(app, coord, 'patch', `/training-modules/${module.id}`)
        .send({ sectionId: to.id })
        .expect(200);

      const progress = await prisma.moduleProgress.findFirstOrThrow({
        where: { teacherId: teacherUser.id, moduleId: module.id },
      });
      expect(progress).toMatchObject({ bestScore: 90 });
      expect(progress.videoViewedAt?.toISOString()).toBe(viewed.toISOString());
    });
  });

  describe('roles y bitácora (R29, R30)', () => {
    it('responde 403 a un docente en las rutas de coordinación y 2xx a coordinación y administración', async () => {
      const plan = await createAreaPlan(app, coord, planning, await newArea());
      const section = await createSection(app, coord, plan.id);
      const module = await createModule(app, coord, section.id);

      for (const [method, path] of [
        ['get', '/training-plans'],
        ['post', '/training-plans'],
        ['get', `/training-plans/${plan.id}/sections`],
        ['post', `/training-plans/${plan.id}/sections`],
        ['patch', `/training-sections/${section.id}`],
        ['post', `/training-sections/${section.id}/modules`],
        ['get', `/training-modules/${module.id}`],
        ['post', `/training-modules/${module.id}/publish`],
        ['put', `/training-modules/${module.id}/slide-order`],
      ] as const) {
        expect([method, path, (await call(app, teacher, method, path).send({})).status]).toEqual([
          method,
          path,
          403,
        ]);
      }
      await call(app, admin, 'get', '/training-plans').expect(200);
      await call(app, admin, 'post', `/training-plans/${plan.id}/sections`)
        .send({ title: `Admin ${unique()}` })
        .expect(201);
    });

    it('registra cada escritura de coordinación con tipo formacion y los datos antes y después', async () => {
      const plan = await createAreaPlan(app, coord, planning, await newArea());
      const section = await createSection(app, coord, plan.id, 'Auditada');
      const module = await createModule(app, coord, section.id, {
        videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
      });
      await call(app, coord, 'patch', `/training-modules/${module.id}`)
        .send({ title: 'Nuevo título' })
        .expect(200);
      await call(app, coord, 'post', `/training-modules/${module.id}/publish`).expect(200);
      await call(
        app,
        coord,
        'delete',
        `/training-sections/${(await createSection(app, coord, plan.id)).id}`,
      ).expect(204);

      const planRows = await trainingAudit(app, plan.id);
      expect(planRows.map((row) => row.action)).toEqual([
        'Creó un plan de formación',
        'Creó una sección de un plan de formación',
        'Creó una sección de un plan de formación',
      ]);
      const moduleRows = await trainingAudit(app, module.id);
      expect(moduleRows.map((row) => row.action)).toEqual([
        'Editó un módulo de formación',
        'Publicó un módulo de formación',
      ]);
      expect(moduleRows[0]).toMatchObject({ entity: 'modulo_formacion', role: 'coordinador' });
      expect(JSON.stringify(moduleRows[0]?.dataAfter)).toContain('Nuevo título');
      const sectionRows = await trainingAudit(app, section.id);
      expect(sectionRows[0]).toMatchObject({ action: 'Creó un módulo de formación en borrador' });
    });

    it('deja `después = null` al quitar una sección vacía', async () => {
      const plan = await createAreaPlan(app, coord, planning, await newArea());
      const section = await createSection(app, coord, plan.id);

      await call(app, coord, 'delete', `/training-sections/${section.id}`).expect(204);

      const rows = await trainingAudit(app, section.id);
      expect(rows.map((row) => row.action)).toEqual([
        'Quitó una sección vacía de un plan de formación',
      ]);
      expect(rows[0]?.dataAfter).toBeNull();
    });
  });
});
