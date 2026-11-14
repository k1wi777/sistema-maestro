import type { INestApplication } from '@nestjs/common';
import {
  UserRole,
  type ChallengeAnswerResult,
  type ChallengeStep,
  type TeacherModule,
} from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { createTestUser, signIn, type Cookies } from './support/session';
import {
  buildModule,
  call,
  correctAnswerOf,
  keysMatching,
  milestonesOf,
  OPTION_QUESTION,
  ORDERING_QUESTION,
  setupCourse,
  SOLUTION_KEYS,
  TRUE_FALSE_QUESTION,
  wrongAnswerOf,
  type Course,
} from './support/training';

// «La correcta» es el texto de una opción y viaja con la pregunta; la retroalimentación no.
const SECRET_TEXTS = ['Era la primera.', 'Es verdad.'];

describe('Desafío GNS calificado en el servidor (BE-7)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let coord: Cookies;

  type Course3 = Course & { moduleId: string };
  async function course(
    questions: Record<string, unknown>[] = [
      OPTION_QUESTION,
      TRUE_FALSE_QUESTION,
      ORDERING_QUESTION,
    ],
    approvalThreshold = 60,
  ): Promise<Course3> {
    const base = await setupCourse(app, planning, coord);
    const module = await buildModule(app, coord, base.section.id, { questions, approvalThreshold });
    return { ...base, moduleId: module.id };
  }

  const url = (c: Course3, tail = '') => `/me/training/modules/${c.moduleId}/challenge${tail}`;
  const start = (c: Course3) => call(app, c.teacher, 'post', url(c));
  const next = (c: Course3) => call(app, c.teacher, 'post', url(c, '/next'));
  const answer = (c: Course3, body: object) =>
    call(app, c.teacher, 'post', url(c, '/answer')).send(body);
  const state = (c: Course3) =>
    prisma.moduleProgress.findUniqueOrThrow({
      where: { teacherId_moduleId: { teacherId: c.user.id, moduleId: c.moduleId } },
    });

  /** Juega una partida completa: `right(i)` decide si la pregunta número `i` se contesta bien. */
  async function play(c: Course3, right: (index: number) => boolean) {
    let step = (await start(c).expect(200)).body as ChallengeStep;
    for (let index = 0; ; index += 1) {
      const questionId = step.question.id;
      const body = {
        questionId,
        answer: right(index)
          ? await correctAnswerOf(app, questionId)
          : await wrongAnswerOf(app, questionId),
      };
      const result = (await answer(c, body).expect(200)).body as ChallengeAnswerResult;
      if (result.finished) {
        return result;
      }
      step = (await next(c).expect(200)).body as ChallengeStep;
    }
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

  it('entrega las preguntas de una en una, sin solución ni retroalimentación (R23)', async () => {
    const c = await course();
    const seen = new Set<string>();

    let step = (await start(c).expect(200)).body as ChallengeStep;
    for (let index = 1; index <= 3; index += 1) {
      expect(step).toMatchObject({ total: 3, position: index });
      expect(keysMatching(step, SOLUTION_KEYS)).toEqual([]);
      for (const secret of SECRET_TEXTS) {
        expect(JSON.stringify(step)).not.toContain(secret);
      }
      seen.add(step.question.id);
      if (step.question.type === 'vf') {
        expect(step.question.options).toBeUndefined();
      } else {
        expect(step.question.options?.length).toBeGreaterThanOrEqual(2);
      }
      const body = {
        questionId: step.question.id,
        answer: await correctAnswerOf(app, step.question.id),
      };
      const result = (await answer(c, body).expect(200)).body as ChallengeAnswerResult;
      if (index < 3) {
        step = (await next(c).expect(200)).body as ChallengeStep;
      } else {
        expect(result.finished).toBe(true);
      }
    }
    expect(seen.size).toBe(3);
  });

  it('mezcla el orden de las preguntas y de las opciones entre partidas', async () => {
    const c = await course();
    const orders = new Set<string>();
    const optionOrders = new Set<string>();

    for (let game = 0; game < 12; game += 1) {
      const step = (await start(c).expect(200)).body as ChallengeStep;
      orders.add(step.question.id);
      optionOrders.add((step.question.options ?? []).map((option) => option.id).join(','));
    }

    // 12 salidas de una elección entre 3: no salir siempre la misma tiene probabilidad ~0.
    expect(orders.size).toBeGreaterThan(1);
    expect(optionOrders.size).toBeGreaterThan(1);
  });

  it('califica en el servidor y revela la respuesta y la retroalimentación solo tras responder (R24)', async () => {
    const c = await course([OPTION_QUESTION]);
    const step = (await start(c).expect(200)).body as ChallengeStep;
    const correct = await correctAnswerOf(app, step.question.id);

    const wrongRes = await answer(c, {
      questionId: step.question.id,
      answer: await wrongAnswerOf(app, step.question.id),
    }).expect(200);

    expect(wrongRes.body).toMatchObject({
      correct: false,
      timedOut: false,
      correctAnswer: correct,
      feedback: OPTION_QUESTION.feedback,
      pointsGained: 0,
      finished: true,
    });
  });

  it('un juego perfecto registra intento, mejor puntaje, aprobación y terminación (R25, R27)', async () => {
    const c = await course();

    const result = await play(c, () => true);

    expect(result.result).toMatchObject({ score: 100, passed: true, bestScore: 100 });
    expect(result.result?.points).toBeGreaterThan(2500);
    expect(result.result?.completedAt).not.toBeNull();
    const row = await state(c);
    expect(row).toMatchObject({ bestScore: 100, challengeGame: null });
    expect(row.passedAt).not.toBeNull();
    expect(row.completedAt).not.toBeNull();
    const attempts = await prisma.challengeAttempt.findMany({ where: { progressId: row.id } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ score: 100, points: result.result?.points });
    // Solo inicio y resultado (más la terminación del módulo): nada por respuesta ni por `next`.
    expect(await milestonesOf(app, c.user.id)).toEqual([
      'Inició el Desafío GNS',
      'Terminó el Desafío GNS',
      'Terminó un módulo',
    ]);
  });

  it('el puntaje solo cuenta aciertos y conserva el mejor intento', async () => {
    const c = await course();

    const failed = await play(c, () => false);
    expect(failed.result).toMatchObject({ score: 0, points: 0, passed: false, completedAt: null });
    expect((await state(c)).passedAt).toBeNull();

    const partial = await play(c, (index) => index < 2);
    expect(partial.result).toMatchObject({ score: 67, passed: true });
    expect(partial.result?.bestScore).toBe(67);

    const worse = await play(c, (index) => index === 0);
    expect(worse.result).toMatchObject({ score: 33, passed: false, bestScore: 67 });
    const row = await state(c);
    expect(row.bestScore).toBe(67);
    expect(row.passedAt).not.toBeNull();
    expect(await prisma.challengeAttempt.count({ where: { progressId: row.id } })).toBe(3);
    expect(worse.result?.bestPoints).toBe(
      Math.max(0, partial.result?.points ?? 0, worse.result?.points ?? 0),
    );
  });

  it('cuenta como incorrecta la respuesta fuera de tiempo según el reloj del servidor', async () => {
    const c = await course([TRUE_FALSE_QUESTION]);
    const step = (await start(c).expect(200)).body as ChallengeStep;
    // Se retrasa el momento en que se sirvió la pregunta: el navegador no envía tiempos.
    await prisma.$executeRaw`
      UPDATE progreso_modulo
      SET partida_desafio = jsonb_set(partida_desafio, '{servedAt}', to_jsonb(to_char((now() - interval '60 seconds') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
      WHERE docente_id = ${c.user.id}::uuid`;

    const res = await answer(c, {
      questionId: step.question.id,
      answer: await correctAnswerOf(app, step.question.id),
    }).expect(200);

    expect(res.body).toMatchObject({ correct: false, timedOut: true, pointsGained: 0 });
    expect((res.body as ChallengeAnswerResult).result).toMatchObject({ score: 0, passed: false });
  });

  it('acepta `answer: null` como tiempo agotado', async () => {
    const c = await course([TRUE_FALSE_QUESTION]);
    const step = (await start(c).expect(200)).body as ChallengeStep;

    const res = await answer(c, { questionId: step.question.id, answer: null }).expect(200);

    expect(res.body).toMatchObject({ correct: false, timedOut: true });
  });

  it('responde 409 sin alterar la nota a una pregunta ajena, repetida o sin partida (R26)', async () => {
    const c = await course();
    await answer(c, { questionId: '00000000-0000-4000-8000-000000000001', answer: null }).expect(
      409,
    );
    await next(c).expect(409);

    const step = (await start(c).expect(200)).body as ChallengeStep;
    await next(c).expect(409);
    const first = await answer(c, {
      questionId: step.question.id,
      answer: await correctAnswerOf(app, step.question.id),
    }).expect(200);
    const afterFirst = (await state(c)).challengeGame;

    await answer(c, {
      questionId: step.question.id,
      answer: await wrongAnswerOf(app, step.question.id),
    }).expect(409);
    await answer(c, { questionId: '00000000-0000-4000-8000-000000000002', answer: null }).expect(
      409,
    );

    expect((first.body as ChallengeAnswerResult).correct).toBe(true);
    expect((await state(c)).challengeGame).toEqual(afterFirst);
    expect(
      await prisma.challengeAttempt.count({ where: { progress: { teacherId: c.user.id } } }),
    ).toBe(0);
  });

  it('responde 400 a una opción de otra pregunta o a una respuesta con la forma equivocada', async () => {
    const c = await course([OPTION_QUESTION]);
    const other = await course([OPTION_QUESTION]);
    const step = (await start(c).expect(200)).body as ChallengeStep;
    const foreign = await prisma.questionOption.findFirstOrThrow({
      where: { question: { moduleId: other.moduleId } },
    });

    await answer(c, { questionId: step.question.id, answer: { optionId: foreign.id } }).expect(400);
    await answer(c, { questionId: step.question.id, answer: { value: true } }).expect(400);
    await answer(c, {
      questionId: step.question.id,
      answer: { optionId: foreign.id },
      tiempo: 1,
    }).expect(400);
    expect((await state(c)).challengeGame).not.toBeNull();
  });

  it('dos respuestas simultáneas a la misma pregunta: una gana y la otra recibe 409 (R28)', async () => {
    const c = await course([OPTION_QUESTION, TRUE_FALSE_QUESTION]);
    const step = (await start(c).expect(200)).body as ChallengeStep;
    const body = {
      questionId: step.question.id,
      answer: await correctAnswerOf(app, step.question.id),
    };

    const results = await Promise.all([answer(c, body), answer(c, body)]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(((await state(c)).challengeGame as { answers: unknown[] }).answers).toHaveLength(1);
  });

  it('una partida nueva reemplaza a la abandonada y no cuenta como intento', async () => {
    const c = await course();
    await start(c).expect(200);
    const abandoned = (await state(c)).challengeGame;

    await start(c).expect(200);

    expect((await state(c)).challengeGame).not.toEqual(abandoned);
    expect(
      await prisma.challengeAttempt.count({ where: { progress: { teacherId: c.user.id } } }),
    ).toBe(0);
    expect(await milestonesOf(app, c.user.id)).toEqual([
      'Inició el Desafío GNS',
      'Inició el Desafío GNS',
    ]);
  });

  it('descarta la partida y responde 409 si coordinación borró la pregunta en curso', async () => {
    const c = await course();
    const step = (await start(c).expect(200)).body as ChallengeStep;
    await call(
      app,
      coord,
      'delete',
      `/training-modules/${c.moduleId}/questions/${step.question.id}`,
    ).expect(204);

    await answer(c, { questionId: step.question.id, answer: null }).expect(409);

    expect((await state(c)).challengeGame).toBeNull();
    await answer(c, { questionId: step.question.id, answer: null }).expect(409);
  });

  it('responde 409 al iniciar un módulo sin preguntas', async () => {
    const base = await setupCourse(app, planning, coord);
    const module = await buildModule(app, coord, base.section.id, { video: true });

    await start({ ...base, moduleId: module.id }).expect(409);
  });

  it('el módulo del docente refleja el mejor puntaje y la aprobación sin soluciones', async () => {
    const c = await course();
    await play(c, () => true);

    const view = (
      await call(app, c.teacher, 'get', `/me/training/modules/${c.moduleId}`).expect(200)
    ).body as TeacherModule;

    expect(view.progress).toMatchObject({ bestScore: 100, attempts: 1 });
    expect(view.progress.passedAt).not.toBeNull();
    expect(view.state).toBe('terminado');
    expect(keysMatching(view, SOLUTION_KEYS)).toEqual([]);
  });
});
