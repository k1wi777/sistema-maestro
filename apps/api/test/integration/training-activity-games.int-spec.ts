import type { INestApplication } from '@nestjs/common';
import {
  TrainingActivityType,
  UserRole,
  type ActivityGameAnswerResult,
  type ActivityGameStep,
} from '@gns/shared';
import { PrismaService } from '../../src/shared/database/prisma.service';
import { createTestApp } from './support/create-test-app';
import { setupPlanning, type Planning } from './support/planning';
import { holdSchoolYearLock, SCHOOL_YEAR_LOCK_TIMEOUT_MS } from './support/school-year-lock';
import { createTestUser, signIn, type Cookies } from './support/session';
import {
  buildModule,
  call,
  keysMatching,
  milestonesOf,
  MYTH_CONFIG,
  setupCourse,
  SOLUTION_KEYS,
  type Course,
} from './support/training';

interface MatchState {
  rounds: { pairs: { conceptToken: string; factToken: string; connected: boolean }[] }[];
  roundIndex: number;
  roundOver: boolean;
}
interface MythState {
  statementIndexes: number[];
  position: number;
}
type Game = Course & { moduleId: string; activityId: string };

describe('conecta y verdad o mito calificados en el servidor (BE-7)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let planning: Planning;
  let release: () => Promise<void>;
  let coord: Cookies;

  async function game(type: TrainingActivityType): Promise<Game> {
    const base = await setupCourse(app, planning, coord);
    const module = await buildModule(app, coord, base.section.id, {
      activities: [{ type, isRequired: true }],
    });
    const activity = await prisma.trainingActivity.findFirstOrThrow({
      where: { moduleId: module.id },
    });
    return { ...base, moduleId: module.id, activityId: activity.id };
  }

  const url = (g: Game, tail = '') => `/me/training/activities/${g.activityId}/game${tail}`;
  const start = (g: Game) => call(app, g.teacher, 'post', url(g));
  const next = (g: Game) => call(app, g.teacher, 'post', url(g, '/next'));
  const answer = (g: Game, body: object) =>
    call(app, g.teacher, 'post', url(g, '/answer')).send(body);
  const progress = (g: Game) =>
    prisma.activityProgress.findFirstOrThrow({
      where: { teacherId: g.user.id, activityId: g.activityId },
    });
  const stored = async <T>(g: Game): Promise<T> => (await progress(g)).game as T;
  const delayRound = (g: Game) =>
    prisma.$executeRaw`
      UPDATE progreso_actividad
      SET partida = jsonb_set(partida, '{servedAt}', to_jsonb(to_char((now() - interval '10 minutes') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
      WHERE docente_id = ${g.user.id}::uuid AND actividad_id = ${g.activityId}::uuid`;

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

  describe('conecta (R22)', () => {
    const pairsOfRound = async (g: Game) => {
      const state = await stored<MatchState>(g);
      return state.rounds[state.roundIndex]?.pairs ?? [];
    };

    /** Conecta cada pareja de la ronda en curso; `wrongFirst` falla una vez la primera. */
    async function connectRound(g: Game, wrongFirst = false) {
      const pairs = await pairsOfRound(g);
      let last: ActivityGameAnswerResult | undefined;
      for (const [index, pair] of pairs.entries()) {
        if (wrongFirst && index === 0) {
          const other = pairs[1];
          const wrong = await answer(g, {
            conceptToken: pair.conceptToken,
            factToken: other?.factToken,
          }).expect(200);
          expect(wrong.body).toMatchObject({ correct: false, pointsGained: 0, streak: 0 });
        }
        last = (
          await answer(g, { conceptToken: pair.conceptToken, factToken: pair.factToken }).expect(
            200,
          )
        ).body as ActivityGameAnswerResult;
      }
      return last as ActivityGameAnswerResult;
    }

    async function playAll(g: Game, wrongFirstInRound?: number) {
      await start(g).expect(200);
      let last: ActivityGameAnswerResult | undefined;
      for (let round = 0; round < 2; round += 1) {
        last = await connectRound(g, wrongFirstInRound === round);
        if (round === 0) {
          await next(g).expect(200);
        }
      }
      return last as ActivityGameAnswerResult;
    }

    it('entrega la ronda con tokens mezclados, sin las parejas ni el estado de la partida', async () => {
      const g = await game(TrainingActivityType.Match);

      const res = await start(g).expect(200);

      const step = res.body as ActivityGameStep;
      expect(step).toMatchObject({ type: 'conecta', finished: false });
      if (step.type !== 'conecta' || !step.round) {
        throw new Error('Se esperaba una ronda');
      }
      expect(step.round).toMatchObject({ round: 1, totalRounds: 2, seconds: 60 });
      expect(step.round.concepts).toHaveLength(2);
      expect(step.round.facts).toHaveLength(2);
      expect(keysMatching(res.body, SOLUTION_KEYS)).toEqual([]);
      expect(keysMatching(res.body, /conceptToken|factToken|pairs|rounds|partida/)).toEqual([]);
      expect(await milestonesOf(app, g.user.id)).toEqual(['Inició una actividad']);
    });

    it('un juego perfecto registra intento, máximos y completado, y termina el módulo', async () => {
      const g = await game(TrainingActivityType.Match);

      const last = await playAll(g);

      expect(last).toMatchObject({ finished: true, roundOver: true });
      expect(last.result).toMatchObject({ score: 100, passed: true, bestScore: 100 });
      expect(last.result?.completedAt).not.toBeNull();
      const row = await progress(g);
      expect(row).toMatchObject({ attempts: 1, bestScore: 100, game: null });
      expect(row.bestPoints).toBe(last.result?.points);
      expect(row.completedAt).not.toBeNull();
      expect(await milestonesOf(app, g.user.id)).toEqual([
        'Inició una actividad',
        'Terminó una actividad',
        'Completó una actividad',
        'Terminó un módulo',
      ]);
    });

    it('un error rompe la racha y el primer intento fallido baja el puntaje', async () => {
      const g = await game(TrainingActivityType.Match);

      const last = await playAll(g, 0);

      // 3 de 4 parejas al primer intento: 75 % no alcanza el umbral de 80.
      expect(last.result).toMatchObject({ score: 75, passed: false, completedAt: null });
      const row = await progress(g);
      expect(row).toMatchObject({ attempts: 1, bestScore: 75, completedAt: null });
      expect((await milestonesOf(app, g.user.id)).includes('Completó una actividad')).toBe(false);

      const better = await playAll(g);
      expect(better.result).toMatchObject({ score: 100, passed: true, bestScore: 100 });
      expect((await progress(g)).attempts).toBe(2);
    });

    it('no puntúa lo respondido fuera de tiempo y la ronda se cierra con next', async () => {
      const g = await game(TrainingActivityType.Match);
      await start(g).expect(200);
      const [pair] = await pairsOfRound(g);
      await delayRound(g);

      const late = await answer(g, {
        conceptToken: pair?.conceptToken,
        factToken: pair?.factToken,
      }).expect(200);

      expect(late.body).toMatchObject({
        correct: false,
        pointsGained: 0,
        roundOver: true,
        finished: false,
      });
      await answer(g, { conceptToken: pair?.conceptToken, factToken: pair?.factToken }).expect(409);
      const second = await next(g).expect(200);
      expect((second.body as { round: { round: number } }).round.round).toBe(2);
    });

    it('responde 409 sin partida, a un concepto ya conectado y a next con la ronda abierta', async () => {
      const g = await game(TrainingActivityType.Match);
      await answer(g, { conceptToken: 'x', factToken: 'y' }).expect(409);
      await next(g).expect(409);
      await start(g).expect(200);
      const [pair] = await pairsOfRound(g);

      await next(g).expect(409);
      await answer(g, { conceptToken: pair?.conceptToken, factToken: pair?.factToken }).expect(200);
      await answer(g, { conceptToken: pair?.conceptToken, factToken: pair?.factToken }).expect(409);
    });

    it('responde 400 a tokens desconocidos y a una respuesta de otro tipo de juego', async () => {
      const g = await game(TrainingActivityType.Match);
      await start(g).expect(200);

      await answer(g, { conceptToken: 'inventado', factToken: 'inventado' }).expect(400);
      await answer(g, { position: 1, value: true }).expect(400);
      await answer(g, { conceptToken: 'a', factToken: 'b', extra: 1 }).expect(400);
    });

    it('descarta la partida y responde 409 si coordinación editó la actividad', async () => {
      const g = await game(TrainingActivityType.Match);
      await start(g).expect(200);
      const [pair] = await pairsOfRound(g);
      await call(app, coord, 'patch', `/training-modules/${g.moduleId}/activities/${g.activityId}`)
        .send({ title: 'Título nuevo' })
        .expect(200);

      await answer(g, { conceptToken: pair?.conceptToken, factToken: pair?.factToken }).expect(409);

      expect((await progress(g)).game).toBeNull();
    });

    it('dos respuestas simultáneas a la misma pareja: una gana y la otra recibe 409 (R28)', async () => {
      const g = await game(TrainingActivityType.Match);
      await start(g).expect(200);
      const [pair] = await pairsOfRound(g);
      const body = { conceptToken: pair?.conceptToken, factToken: pair?.factToken };

      const results = await Promise.all([answer(g, body), answer(g, body)]);

      expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    });
  });

  describe('verdad o mito (R22)', () => {
    const verdictOf = async (g: Game, position = 0): Promise<boolean> => {
      const state = await stored<MythState>(g);
      return (
        MYTH_CONFIG.afirmaciones[state.statementIndexes[state.position + position] ?? 0]
          ?.es_verdad ?? true
      );
    };

    async function playAll(g: Game, right: (index: number) => boolean) {
      await start(g).expect(200);
      for (let index = 1; ; index += 1) {
        const verdict = await verdictOf(g);
        const res = (
          await answer(g, { position: index, value: right(index - 1) ? verdict : !verdict }).expect(
            200,
          )
        ).body as ActivityGameAnswerResult;
        if (res.type === 'verdad_o_mito' && res.finished) {
          return res;
        }
        await next(g).expect(200);
      }
    }

    it('entrega la afirmación sin su veredicto ni su explicación', async () => {
      const g = await game(TrainingActivityType.TrueOrMyth);

      const res = await start(g).expect(200);

      expect(res.body).toMatchObject({
        type: 'verdad_o_mito',
        finished: false,
        total: 3,
        lives: 2,
        statement: { position: 1, seconds: 30 },
      });
      expect(keysMatching(res.body, SOLUTION_KEYS)).toEqual([]);
      expect(JSON.stringify(res.body)).not.toContain('Explicación');
    });

    it('revela el veredicto y la explicación solo después de responder', async () => {
      const g = await game(TrainingActivityType.TrueOrMyth);
      await start(g).expect(200);
      const verdict = await verdictOf(g);

      const res = await answer(g, { position: 1, value: verdict }).expect(200);

      expect(res.body).toMatchObject({ correct: true, isTrue: verdict, lives: 2, finished: false });
      expect(JSON.stringify(res.body)).toContain('Explicación');
    });

    it('un juego perfecto aprueba, completa la actividad y termina el módulo', async () => {
      const g = await game(TrainingActivityType.TrueOrMyth);

      const last = await playAll(g, () => true);

      expect(last.result).toMatchObject({ score: 100, passed: true });
      expect(await progress(g)).toMatchObject({ attempts: 1, bestScore: 100, game: null });
      expect(await milestonesOf(app, g.user.id)).toEqual([
        'Inició una actividad',
        'Terminó una actividad',
        'Completó una actividad',
        'Terminó un módulo',
      ]);
    });

    it('termina sin vidas, no completa la actividad y next responde 409', async () => {
      const g = await game(TrainingActivityType.TrueOrMyth);

      const last = await playAll(g, () => false);

      expect(last).toMatchObject({ lives: 0, finished: true });
      expect(last.result).toMatchObject({ score: 0, passed: false, completedAt: null });
      expect(await progress(g)).toMatchObject({ attempts: 1, completedAt: null });
      await next(g).expect(409);
    });

    it('cuenta como error el tiempo agotado y rechaza posiciones que no son la en curso', async () => {
      const g = await game(TrainingActivityType.TrueOrMyth);
      await start(g).expect(200);

      await answer(g, { position: 2, value: true }).expect(409);
      const timedOut = await answer(g, { position: 1, value: null }).expect(200);
      expect(timedOut.body).toMatchObject({ correct: false, timedOut: true, lives: 1 });
      await answer(g, { position: 1, value: true }).expect(409);

      await next(g).expect(200);
      await delayRound(g);
      const late = await answer(g, { position: 2, value: await verdictOf(g) }).expect(200);
      expect(late.body).toMatchObject({ correct: false, timedOut: true, lives: 0, finished: true });
    });
  });

  it('las actividades que no tienen partida responden 409 al iniciar una', async () => {
    const g = await game(TrainingActivityType.Simulator);

    await start(g).expect(409);
  });
});
