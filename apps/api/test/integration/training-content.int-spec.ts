import type { INestApplication } from '@nestjs/common';
import {
  ChallengeQuestionType,
  TrainingActivityType,
  UserRole,
  type TrainingModuleDetail,
} from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { createTestUser, signIn, type Cookies } from './support/session';
import {
  addActivity,
  addQuestion,
  addSlide,
  buildModule,
  call,
  CONFIG_BY_TYPE,
  createAreaPlan,
  createSection,
  ORDERING_QUESTION,
  OPTION_QUESTION,
  TRUE_FALSE_QUESTION,
  trainingAudit,
} from './support/training';

describe('contenido de los módulos de formación (BE-7)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let coord: Cookies;
  let sectionId: string;

  const detail = async (moduleId: string) =>
    (await call(app, coord, 'get', `/training-modules/${moduleId}`).expect(200))
      .body as TrainingModuleDetail;
  const freshModule = (options = {}) =>
    buildModule(app, coord, sectionId, { video: true, publish: false, ...options });

  beforeAll(async () => {
    release = await holdSchoolYearLock('shared');
    app = await createTestApp({ withFailures: false });
    prisma = app.get(PrismaService);
    planning = await setupPlanning(app);
    coord = await signIn(app, await createTestUser(app, { role: UserRole.Coordinator }));
    const { areaId } = await planning.gradeAndArea('Primaria');
    sectionId = (
      await createSection(app, coord, (await createAreaPlan(app, coord, planning, areaId)).id)
    ).id;
  }, SCHOOL_YEAR_LOCK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await release();
  });

  describe('diapositivas (R9)', () => {
    it('crea, edita y quita diapositivas', async () => {
      const module = await freshModule();
      const slide = await addSlide(app, coord, module.id, 'Primera');

      const edited = await call(
        app,
        coord,
        'patch',
        `/training-modules/${module.id}/slides/${slide.id}`,
      )
        .send({ title: 'Editada', keyIdeas: 'Una idea' })
        .expect(200);
      expect(edited.body).toMatchObject({ title: 'Editada', keyIdeas: 'Una idea', sortOrder: 1 });
      await call(app, coord, 'patch', `/training-modules/${module.id}/slides/${slide.id}`)
        .send({ extra: true })
        .expect(400);

      await call(app, coord, 'delete', `/training-modules/${module.id}/slides/${slide.id}`).expect(
        204,
      );
      expect((await detail(module.id)).slides).toEqual([]);
      await call(app, coord, 'delete', `/training-modules/${module.id}/slides/${slide.id}`).expect(
        404,
      );
    });

    it('no toca una diapositiva de otro módulo', async () => {
      const a = await freshModule();
      const b = await freshModule();
      const slide = await addSlide(app, coord, b.id);

      await call(app, coord, 'delete', `/training-modules/${a.id}/slides/${slide.id}`).expect(404);
      expect((await detail(b.id)).slides).toHaveLength(1);
    });
  });

  describe('preguntas del Desafío (R10)', () => {
    it('guarda los tres tipos con sus columnas propias', async () => {
      const module = await freshModule();
      const option = await addQuestion(app, coord, module.id, OPTION_QUESTION);
      const trueFalse = await addQuestion(app, coord, module.id, TRUE_FALSE_QUESTION);
      const ordering = await addQuestion(app, coord, module.id, ORDERING_QUESTION);

      const rows = await prisma.challengeQuestion.findMany({
        where: { moduleId: module.id },
        include: { options: true },
        orderBy: { sortOrder: 'asc' },
      });
      expect(rows.map((row) => [row.id, row.type, row.sortOrder])).toEqual([
        [option.id, ChallengeQuestionType.MultipleChoice, 1],
        [trueFalse.id, ChallengeQuestionType.TrueFalse, 2],
        [ordering.id, ChallengeQuestionType.Ordering, 3],
      ]);
      const [optionRow, tfRow, orderRow] = rows;
      expect(optionRow?.trueFalseAnswer).toBeNull();
      expect(optionRow?.options.filter((o) => o.isCorrect).map((o) => o.correctPosition)).toEqual([
        null,
      ]);
      expect(tfRow).toMatchObject({ trueFalseAnswer: true, options: [] });
      expect(orderRow?.options.every((o) => o.isCorrect === null)).toBe(true);
      expect(orderRow?.options.map((o) => [o.text, o.correctPosition]).sort()).toEqual([
        ['Primero', 1],
        ['Segundo', 2],
        ['Tercero', 3],
      ]);
    });

    it.each([
      [
        'sin opción correcta',
        {
          ...OPTION_QUESTION,
          options: OPTION_QUESTION.options.map((o) => ({ ...o, isCorrect: false })),
        },
      ],
      [
        'con dos correctas',
        {
          ...OPTION_QUESTION,
          options: OPTION_QUESTION.options.map((o) => ({ ...o, isCorrect: true })),
        },
      ],
      ['con una sola opción', { ...OPTION_QUESTION, options: [OPTION_QUESTION.options[0]] }],
      ['verdadero o falso sin respuesta', { type: 'vf', prompt: 'x' }],
      ['verdadero o falso con opciones', { ...TRUE_FALSE_QUESTION, options: [] }],
      ['ordenar con un paso', { ...ORDERING_QUESTION, steps: ['Solo'] }],
      ['de un tipo desconocido', { type: 'abierta', prompt: 'x' }],
    ])('responde 400 a una pregunta %s y no guarda nada', async (_name, body) => {
      const module = await freshModule();

      await call(app, coord, 'post', `/training-modules/${module.id}/questions`)
        .send(body)
        .expect(400);

      expect(await prisma.challengeQuestion.count({ where: { moduleId: module.id } })).toBe(0);
    });

    it('reemplaza la pregunta con sus opciones o no cambia nada si es inválida', async () => {
      const module = await freshModule();
      const question = await addQuestion(app, coord, module.id, OPTION_QUESTION);
      const before = await prisma.questionOption.findMany({ where: { questionId: question.id } });

      await call(app, coord, 'put', `/training-modules/${module.id}/questions/${question.id}`)
        .send({ ...OPTION_QUESTION, options: [] })
        .expect(400);
      expect(await prisma.questionOption.findMany({ where: { questionId: question.id } })).toEqual(
        before,
      );

      const replaced = await call(
        app,
        coord,
        'put',
        `/training-modules/${module.id}/questions/${question.id}`,
      )
        .send(TRUE_FALSE_QUESTION)
        .expect(200);
      expect(replaced.body).toMatchObject({ type: 'vf', trueFalseAnswer: true, options: [] });
      expect(await prisma.questionOption.count({ where: { questionId: question.id } })).toBe(0);
    });

    it('quita una pregunta con sus opciones y reordena con la lista completa', async () => {
      const module = await freshModule();
      const a = await addQuestion(app, coord, module.id, OPTION_QUESTION);
      const b = await addQuestion(app, coord, module.id, TRUE_FALSE_QUESTION);
      const c = await addQuestion(app, coord, module.id, ORDERING_QUESTION);

      await call(app, coord, 'put', `/training-modules/${module.id}/question-order`)
        .send({ ids: [c.id, b.id, a.id] })
        .expect(200);
      expect((await detail(module.id)).questions.map((q) => q.id)).toEqual([c.id, b.id, a.id]);
      await call(app, coord, 'put', `/training-modules/${module.id}/question-order`)
        .send({ ids: [c.id, b.id] })
        .expect(409);

      await call(app, coord, 'delete', `/training-modules/${module.id}/questions/${a.id}`).expect(
        204,
      );
      expect(await prisma.questionOption.count({ where: { questionId: a.id } })).toBe(0);
      expect((await detail(module.id)).questions).toHaveLength(2);
    });

    it('incluye las soluciones en el editor de coordinación', async () => {
      const module = await freshModule({ questions: [OPTION_QUESTION] });

      const { questions } = await detail(module.id);

      expect(questions[0]?.options.filter((option) => option.isCorrect)).toHaveLength(1);
      expect(questions[0]?.feedback).toBe(OPTION_QUESTION.feedback);
    });
  });

  describe('actividades (R11, R12)', () => {
    it.each(Object.values(TrainingActivityType))('crea una actividad de tipo %s', async (type) => {
      const module = await freshModule();

      const activity = await addActivity(app, coord, module.id, type, { isRequired: true });

      expect(activity).toMatchObject({ type, status: 'activo', isRequired: true, sortOrder: 1 });
      const row = await prisma.trainingActivity.findUniqueOrThrow({ where: { id: activity.id } });
      expect(row.config).toMatchObject(JSON.parse(JSON.stringify(CONFIG_BY_TYPE[type])) as object);
    });

    it('responde 400 a una configuración de otro tipo o sin los campos del tipo', async () => {
      const module = await freshModule();

      await call(app, coord, 'post', `/training-modules/${module.id}/activities`)
        .send({
          type: TrainingActivityType.Simulator,
          title: 'Mal',
          isRequired: false,
          config: CONFIG_BY_TYPE[TrainingActivityType.Match],
        })
        .expect(400);
      await call(app, coord, 'post', `/training-modules/${module.id}/activities`)
        .send({ type: 'quiz', title: 'Mal', isRequired: false, config: {} })
        .expect(400);
      expect(await prisma.trainingActivity.count({ where: { moduleId: module.id } })).toBe(0);
    });

    it('edita título, instrucciones, obligatoriedad y configuración, pero no el tipo (400)', async () => {
      const module = await freshModule();
      const activity = await addActivity(app, coord, module.id, TrainingActivityType.Match);
      const url = `/training-modules/${module.id}/activities/${activity.id}`;

      const edited = await call(app, coord, 'patch', url)
        .send({ title: 'Nuevo', isRequired: true, instructions: 'Conecta rápido' })
        .expect(200);
      expect(edited.body).toMatchObject({
        title: 'Nuevo',
        isRequired: true,
        instructions: 'Conecta rápido',
      });
      await call(app, coord, 'patch', url)
        .send({ config: { ...CONFIG_BY_TYPE.conecta, segundos_por_ronda: 45 } })
        .expect(200);
      await call(app, coord, 'patch', url)
        .send({ type: TrainingActivityType.Simulator })
        .expect(400);
      await call(app, coord, 'patch', url)
        .send({ config: { pares: [] } })
        .expect(400);
      const row = await prisma.trainingActivity.findUniqueOrThrow({ where: { id: activity.id } });
      expect(row.type).toBe(TrainingActivityType.Match);
      expect(row.config).toMatchObject({ segundos_por_ronda: 45 });
    });

    it('saca y restaura una actividad conservando el progreso, y rechaza transiciones repetidas', async () => {
      const module = await freshModule();
      const activity = await addActivity(app, coord, module.id, TrainingActivityType.Simulator);
      const teacher = await createTestUser(app);
      await prisma.activityProgress.create({
        data: { teacherId: teacher.id, activityId: activity.id, attempts: 3, bestScore: 77 },
      });
      const url = `/training-modules/${module.id}/activities/${activity.id}`;

      await call(app, coord, 'post', `${url}/restore`).expect(409);
      expect((await call(app, coord, 'post', `${url}/withdraw`).expect(200)).body).toMatchObject({
        status: 'fuera_del_plan',
      });
      await call(app, coord, 'post', `${url}/withdraw`).expect(409);
      expect((await call(app, coord, 'post', `${url}/restore`).expect(200)).body).toMatchObject({
        status: 'activo',
      });

      expect(
        await prisma.activityProgress.findFirstOrThrow({ where: { activityId: activity.id } }),
      ).toMatchObject({ attempts: 3, bestScore: 77 });
    });

    it('reordena las actividades con la lista completa', async () => {
      const module = await freshModule();
      const a = await addActivity(app, coord, module.id, TrainingActivityType.Simulator);
      const b = await addActivity(app, coord, module.id, TrainingActivityType.Match);

      await call(app, coord, 'put', `/training-modules/${module.id}/activity-order`)
        .send({ ids: [b.id, a.id] })
        .expect(200);
      expect((await detail(module.id)).activities.map((activity) => activity.id)).toEqual([
        b.id,
        a.id,
      ]);
      await call(app, coord, 'put', `/training-modules/${module.id}/activity-order`)
        .send({ ids: [a.id] })
        .expect(409);
    });
  });

  describe('bitácora y no encontrados', () => {
    it('audita el módulo con los datos de la sección que cambió', async () => {
      const module = await freshModule();
      const slide = await addSlide(app, coord, module.id, 'Auditada');
      await call(app, coord, 'delete', `/training-modules/${module.id}/slides/${slide.id}`).expect(
        204,
      );

      const rows = await trainingAudit(app, module.id);

      expect(rows.map((row) => row.action)).toEqual([
        'Agregó una diapositiva a un módulo de formación',
        'Quitó una diapositiva de un módulo de formación',
      ]);
      expect(JSON.stringify(rows[0]?.dataAfter)).toContain('Auditada');
      expect(rows[1]?.dataAfter).toMatchObject({ slides: [] });
    });

    it('responde 404 a un módulo que no existe', async () => {
      const missing = '00000000-0000-4000-8000-000000000001';

      await call(app, coord, 'get', `/training-modules/${missing}`).expect(404);
      await call(app, coord, 'post', `/training-modules/${missing}/slides`)
        .send({ keyIdeas: 'x' })
        .expect(404);
    });
  });
});
