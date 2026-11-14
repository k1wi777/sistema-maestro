import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  parseActivityConfig,
  TrainingActivityType,
  type ActivityGameAnswerBody,
  type ActivityGameAnswerResult,
  type ActivityGameStep,
  type ChallengeAnswerBody,
  type ChallengeAnswerResult,
  type ChallengeQuestion,
  type ChallengeStep,
  type GameResult,
  type MatchConfig,
  type TrueOrMythConfig,
} from '@gns/shared';
import type { z } from 'zod';
import type { RequestUser } from '../../../core/audit/request-user';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../shared/database/transaction-runner';
import {
  TRAINING_CONTENT_REPOSITORY,
  type TrainingContentRepository,
} from '../content/training-content.repository';
import type { ActivityScopeRow } from '../plans/training-plan.repository';
import { ModuleCompletionService } from '../progress/module-completion.service';
import { TrainingMilestones } from '../progress/training-milestones';
import {
  TRAINING_PROGRESS_REPOSITORY,
  type ActivityProgressRecord,
  type ModuleProgressRecord,
  type TrainingProgressRepository,
} from '../progress/training-progress.repository';
import { TrainingRouteService } from '../route/training-route.service';
import {
  answerChallenge,
  challengeScore,
  nextChallenge,
  startChallenge,
  StaleGameError,
  type EngineQuestion,
} from './challenge-engine';
import {
  challengeGameStateSchema,
  matchGameStateSchema,
  parseGameState,
  trueOrMythGameStateSchema,
  type MatchGameState,
  type TrueOrMythGameState,
} from './game-state';
import { answerMatch, nextMatch, startMatch } from './match-engine';
import { answerTrueOrMyth, nextTrueOrMyth, startTrueOrMyth } from './true-or-myth-engine';

const NO_GAME = 'No tienes una partida en curso: inicia una nueva';
const STALE_GAME = 'El contenido cambió mientras jugabas: inicia una nueva partida';

type Outcome<T> = { kind: 'ok'; value: T } | { kind: 'none' } | { kind: 'stale' };

const toEngineQuestion = (question: ChallengeQuestion): EngineQuestion => ({
  id: question.id,
  type: question.type,
  prompt: question.prompt,
  feedback: question.feedback,
  trueFalseAnswer: question.trueFalseAnswer,
  options: question.options,
});

/**
 * Desafío GNS, conecta y verdad o mito calificados en el servidor. Cada partida vive en la fila
 * de progreso del docente (`partida_desafio`, `partida`): el cliente nunca recibe soluciones
 * antes de responder, el reloj es el del servidor y la nota depende solo de lo respondido.
 */
@Injectable()
export class TrainingGamesService {
  constructor(
    @Inject(TRAINING_PROGRESS_REPOSITORY) private readonly progress: TrainingProgressRepository,
    @Inject(TRAINING_CONTENT_REPOSITORY) private readonly content: TrainingContentRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactions: TransactionRunner,
    private readonly route: TrainingRouteService,
    private readonly completion: ModuleCompletionService,
    private readonly milestones: TrainingMilestones,
  ) {}

  /** Una partida que ya no existe o quedó obsoleta se descartó dentro de la transacción: ahora se responde 409. */
  private unwrap<T>(outcome: Outcome<T>): T {
    if (outcome.kind === 'none') {
      throw new ConflictException(NO_GAME);
    }
    if (outcome.kind === 'stale') {
      throw new ConflictException(STALE_GAME);
    }
    return outcome.value;
  }

  // ---------- Desafío GNS ----------

  async startChallenge(user: RequestUser, moduleId: string): Promise<ChallengeStep> {
    const module = await this.route.requireVisibleModule(user, moduleId);
    const questions = (await this.content.listQuestions(moduleId)).map(toEngineQuestion);
    const { state, step } = startChallenge(questions, module.secondsPerQuestion, new Date());
    return this.transactions.run(async () => {
      const progress = await this.progress.lockModuleProgress(user.id, moduleId);
      await this.progress.updateModuleProgress(progress.id, { challengeGame: state });
      await this.milestones.challengeStarted(user, progress.id, moduleId);
      return step;
    });
  }

  async answerChallenge(
    user: RequestUser,
    moduleId: string,
    body: ChallengeAnswerBody,
  ): Promise<ChallengeAnswerResult> {
    const module = await this.route.requireVisibleModule(user, moduleId);
    const outcome = await this.transactions.run<Outcome<ChallengeAnswerResult>>(async () => {
      const progress = await this.progress.lockModuleProgress(user.id, moduleId);
      const state = parseGameState(challengeGameStateSchema, progress.challengeGame);
      if (!state) {
        return { kind: 'none' };
      }
      const questions = await this.questionMap(moduleId);
      const now = new Date();
      let result: ReturnType<typeof answerChallenge>;
      try {
        result = answerChallenge(state, questions, module.secondsPerQuestion, body, now);
      } catch (error) {
        if (error instanceof StaleGameError) {
          await this.progress.updateModuleProgress(progress.id, { challengeGame: null });
          return { kind: 'stale' };
        }
        throw error;
      }
      if (!result.tally) {
        await this.progress.updateModuleProgress(progress.id, { challengeGame: result.state });
        return { kind: 'ok', value: result.response };
      }

      const score = challengeScore(result.tally);
      const points = result.tally.points;
      const passed = score >= module.approvalThreshold;
      const attemptId = await this.progress.insertAttempt(progress.id, score, points, now);
      const updated = await this.progress.updateModuleProgress(progress.id, {
        bestScore: Math.max(progress.bestScore ?? 0, score),
        // `aprobado_en` se fija la primera vez que se alcanza el umbral y nunca se borra.
        ...(passed && !progress.passedAt ? { passedAt: now } : {}),
        challengeGame: null,
      });
      await this.milestones.challengeFinished(user, attemptId, moduleId, { score, points, passed });
      const completedAt = await this.completion.evaluate(user, moduleId, updated);
      const gameResult: GameResult = {
        score,
        points,
        passed,
        bestScore: updated.bestScore ?? score,
        bestPoints: (await this.progress.maxChallengePoints(progress.id)) ?? points,
        completedAt,
      };
      return { kind: 'ok', value: { ...result.response, result: gameResult } };
    });
    return this.unwrap(outcome);
  }

  async nextChallenge(user: RequestUser, moduleId: string): Promise<ChallengeStep> {
    const module = await this.route.requireVisibleModule(user, moduleId);
    const outcome = await this.transactions.run<Outcome<ChallengeStep>>(async () => {
      const progress = await this.progress.lockModuleProgress(user.id, moduleId);
      const state = parseGameState(challengeGameStateSchema, progress.challengeGame);
      if (!state) {
        return { kind: 'none' };
      }
      try {
        const next = nextChallenge(
          state,
          await this.questionMap(moduleId),
          module.secondsPerQuestion,
          new Date(),
        );
        await this.progress.updateModuleProgress(progress.id, { challengeGame: next.state });
        return { kind: 'ok', value: next.step };
      } catch (error) {
        if (error instanceof StaleGameError) {
          await this.progress.updateModuleProgress(progress.id, { challengeGame: null });
          return { kind: 'stale' };
        }
        throw error;
      }
    });
    return this.unwrap(outcome);
  }

  private async questionMap(moduleId: string): Promise<Map<string, EngineQuestion>> {
    const questions = await this.content.listQuestions(moduleId);
    return new Map(questions.map((question) => [question.id, toEngineQuestion(question)]));
  }

  // ---------- Conecta y verdad o mito ----------

  private async requireGame(
    user: RequestUser,
    activityId: string,
  ): Promise<{
    scope: ActivityScopeRow;
    type: 'conecta' | 'verdad_o_mito';
    match?: MatchConfig;
    trueOrMyth?: TrueOrMythConfig;
  }> {
    const scope = await this.route.requireVisibleActivity(user, activityId);
    if (scope.activity.type === TrainingActivityType.Match) {
      const parsed = parseActivityConfig(TrainingActivityType.Match, scope.activity.config);
      if (!parsed.success) {
        throw new ConflictException('La configuración de la actividad no es válida');
      }
      return { scope, type: 'conecta', match: parsed.data };
    }
    if (scope.activity.type === TrainingActivityType.TrueOrMyth) {
      const parsed = parseActivityConfig(TrainingActivityType.TrueOrMyth, scope.activity.config);
      if (!parsed.success) {
        throw new ConflictException('La configuración de la actividad no es válida');
      }
      return { scope, type: 'verdad_o_mito', trueOrMyth: parsed.data };
    }
    throw new ConflictException('Esta actividad no tiene partidas');
  }

  async startActivityGame(user: RequestUser, activityId: string): Promise<ActivityGameStep> {
    const game = await this.requireGame(user, activityId);
    const now = new Date();
    const updatedAt = game.scope.activity.updatedAt;
    let state: MatchGameState | TrueOrMythGameState;
    let step: ActivityGameStep;
    if (game.type === 'conecta') {
      const started = startMatch(game.match as MatchConfig, updatedAt, now);
      state = started.state;
      step = { type: 'conecta', finished: false, round: started.round };
    } else {
      const started = startTrueOrMyth(game.trueOrMyth as TrueOrMythConfig, updatedAt, now);
      state = started.state;
      step = { type: 'verdad_o_mito', finished: false, ...started.step };
    }
    return this.transactions.run(async () => {
      const { progress } = await this.lockActivity(user, game.scope);
      await this.progress.updateActivityProgress(progress.id, { game: state });
      await this.milestones.activityStarted(user, progress.id, activityId);
      return step;
    });
  }

  async answerActivityGame(
    user: RequestUser,
    activityId: string,
    body: ActivityGameAnswerBody,
  ): Promise<ActivityGameAnswerResult> {
    const game = await this.requireGame(user, activityId);
    const isMatchBody = 'conceptToken' in body;
    if (isMatchBody !== (game.type === 'conecta')) {
      throw new BadRequestException('La respuesta no corresponde al tipo de esta actividad');
    }
    const outcome = await this.transactions.run<Outcome<ActivityGameAnswerResult>>(async () => {
      const { moduleProgress, progress } = await this.lockActivity(user, game.scope);
      const now = new Date();
      try {
        if (game.type === 'conecta' && 'conceptToken' in body) {
          const state = this.activeState(matchGameStateSchema, progress, game.scope);
          if (!state) {
            return { kind: 'none' };
          }
          const result = answerMatch(state, game.match as MatchConfig, body, now);
          if (!result.tally) {
            await this.progress.updateActivityProgress(progress.id, { game: result.state });
            return { kind: 'ok', value: result.response };
          }
          const gameResult = await this.finishActivityGame(
            user,
            game.scope,
            moduleProgress,
            progress,
            result.tally,
            (game.match as MatchConfig).umbral_aprobacion,
          );
          return { kind: 'ok', value: { ...result.response, result: gameResult } };
        }
        if (game.type === 'verdad_o_mito' && 'position' in body) {
          const state = this.activeState(trueOrMythGameStateSchema, progress, game.scope);
          if (!state) {
            return { kind: 'none' };
          }
          const result = answerTrueOrMyth(state, game.trueOrMyth as TrueOrMythConfig, body, now);
          if (!result.tally) {
            await this.progress.updateActivityProgress(progress.id, { game: result.state });
            return { kind: 'ok', value: result.response };
          }
          const gameResult = await this.finishActivityGame(
            user,
            game.scope,
            moduleProgress,
            progress,
            result.tally,
            (game.trueOrMyth as TrueOrMythConfig).umbral_aprobacion,
          );
          return { kind: 'ok', value: { ...result.response, result: gameResult } };
        }
        throw new BadRequestException('La respuesta no corresponde al tipo de esta actividad');
      } catch (error) {
        if (error instanceof StaleGameError) {
          await this.progress.updateActivityProgress(progress.id, { game: null });
          return { kind: 'stale' };
        }
        throw error;
      }
    });
    return this.unwrap(outcome);
  }

  async nextActivityGame(user: RequestUser, activityId: string): Promise<ActivityGameStep> {
    const game = await this.requireGame(user, activityId);
    const outcome = await this.transactions.run<Outcome<ActivityGameStep>>(async () => {
      const { moduleProgress, progress } = await this.lockActivity(user, game.scope);
      const now = new Date();
      try {
        if (game.type === 'conecta') {
          const state = this.activeState(matchGameStateSchema, progress, game.scope);
          if (!state) {
            return { kind: 'none' };
          }
          const result = nextMatch(state, game.match as MatchConfig, now);
          if (result.tally) {
            const gameResult = await this.finishActivityGame(
              user,
              game.scope,
              moduleProgress,
              progress,
              result.tally,
              (game.match as MatchConfig).umbral_aprobacion,
            );
            return {
              kind: 'ok',
              value: { type: 'conecta', finished: true, result: gameResult },
            };
          }
          await this.progress.updateActivityProgress(progress.id, { game: result.state });
          return {
            kind: 'ok',
            value: {
              type: 'conecta',
              finished: false,
              ...(result.round ? { round: result.round } : {}),
            },
          };
        }
        const state = this.activeState(trueOrMythGameStateSchema, progress, game.scope);
        if (!state) {
          return { kind: 'none' };
        }
        const next = nextTrueOrMyth(state, game.trueOrMyth as TrueOrMythConfig, now);
        await this.progress.updateActivityProgress(progress.id, { game: next.state });
        return {
          kind: 'ok',
          value: {
            type: 'verdad_o_mito',
            finished: false,
            total: next.step.total,
            lives: next.step.lives,
            statement: next.step.statement,
          },
        };
      } catch (error) {
        if (error instanceof StaleGameError) {
          await this.progress.updateActivityProgress(progress.id, { game: null });
          return { kind: 'stale' };
        }
        throw error;
      }
    });
    return this.unwrap(outcome);
  }

  /** Siempre módulo y luego actividad: la actividad puede terminar el módulo. */
  private async lockActivity(
    user: RequestUser,
    scope: ActivityScopeRow,
  ): Promise<{ moduleProgress: ModuleProgressRecord; progress: ActivityProgressRecord }> {
    const moduleProgress = await this.progress.lockModuleProgress(user.id, scope.activity.moduleId);
    const progress = await this.progress.lockActivityProgress(user.id, scope.activity.id);
    return { moduleProgress, progress };
  }

  /** Estado legible y de la misma versión de la actividad; si no, no hay partida utilizable. */
  private activeState<T extends { activityUpdatedAt: string }>(
    schema: z.ZodType<T>,
    progress: ActivityProgressRecord,
    scope: ActivityScopeRow,
  ): T | null {
    const state = parseGameState(schema, progress.game);
    if (!state) {
      return null;
    }
    // Una actividad editada a mitad de partida invalida los elementos elegidos.
    if (state.activityUpdatedAt !== scope.activity.updatedAt.toISOString()) {
      throw new StaleGameError();
    }
    return state;
  }

  /** Intento, máximos, `completada_en`, hitos y terminación del módulo, en la misma transacción. */
  private async finishActivityGame(
    user: RequestUser,
    scope: ActivityScopeRow,
    moduleProgress: ModuleProgressRecord,
    progress: ActivityProgressRecord,
    tally: { score: number; points: number },
    threshold: number,
  ): Promise<GameResult> {
    const passed = tally.score >= threshold;
    const completesNow = passed && progress.completedAt === null;
    const now = new Date();
    const updated = await this.progress.updateActivityProgress(progress.id, {
      attempts: progress.attempts + 1,
      bestScore: Math.max(progress.bestScore ?? 0, tally.score),
      bestPoints: Math.max(progress.bestPoints ?? 0, tally.points),
      ...(completesNow ? { completedAt: now } : {}),
      game: null,
    });
    const activityId = scope.activity.id;
    await this.milestones.activityFinished(user, progress.id, activityId, {
      score: tally.score,
      points: tally.points,
      passed,
    });
    if (completesNow) {
      await this.milestones.activityCompleted(user, progress.id, activityId, now);
    }
    await this.completion.evaluate(user, scope.activity.moduleId, moduleProgress);
    return {
      score: tally.score,
      points: tally.points,
      passed,
      bestScore: updated.bestScore ?? tally.score,
      bestPoints: updated.bestPoints ?? tally.points,
      completedAt: updated.completedAt,
    };
  }
}
