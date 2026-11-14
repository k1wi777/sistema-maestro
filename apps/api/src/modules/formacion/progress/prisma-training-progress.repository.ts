import { Injectable } from '@nestjs/common';
import { TrainingActivityStatus } from '@gns/shared';
import {
  Prisma,
  type ActivityProgress as ActivityProgressRow,
  type ModuleProgress as ModuleProgressRow,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import type {
  ActivityProgressChanges,
  ActivityProgressRecord,
  CompletionSnapshot,
  ModuleProgressChanges,
  ModuleProgressRecord,
  ModuleProgressView,
  TrainingProgressRepository,
} from './training-progress.repository';

const toModuleProgress = (row: ModuleProgressRow): ModuleProgressRecord => ({
  id: row.id,
  teacherId: row.teacherId,
  moduleId: row.moduleId,
  videoViewedAt: row.videoViewedAt,
  presentationViewedAt: row.presentationViewedAt,
  bestScore: row.bestScore,
  passedAt: row.passedAt,
  completedAt: row.completedAt,
  challengeGame: row.challengeGame,
});

const toActivityProgress = (row: ActivityProgressRow): ActivityProgressRecord => ({
  id: row.id,
  teacherId: row.teacherId,
  activityId: row.activityId,
  completedAt: row.completedAt,
  bestScore: row.bestScore,
  bestPoints: row.bestPoints,
  attempts: row.attempts,
  detail: row.detail,
  game: row.game,
});

/** `null` es el NULL de la base; `undefined`, no tocar la columna. */
function jsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? Prisma.DbNull : value;
}

@Injectable()
export class PrismaTrainingProgressRepository implements TrainingProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  async lockModuleProgress(teacherId: string, moduleId: string): Promise<ModuleProgressRecord> {
    await this.prisma.db.$executeRaw`
      INSERT INTO progreso_modulo (docente_id, modulo_id)
      VALUES (${teacherId}::uuid, ${moduleId}::uuid)
      ON CONFLICT (docente_id, modulo_id) DO NOTHING`;
    await this.prisma.db.$queryRaw`
      SELECT id FROM progreso_modulo
      WHERE docente_id = ${teacherId}::uuid AND modulo_id = ${moduleId}::uuid FOR UPDATE`;
    const row = await this.prisma.db.moduleProgress.findUniqueOrThrow({
      where: { teacherId_moduleId: { teacherId, moduleId } },
    });
    return toModuleProgress(row);
  }

  async lockActivityProgress(
    teacherId: string,
    activityId: string,
  ): Promise<ActivityProgressRecord> {
    await this.prisma.db.$executeRaw`
      INSERT INTO progreso_actividad (docente_id, actividad_id)
      VALUES (${teacherId}::uuid, ${activityId}::uuid)
      ON CONFLICT (docente_id, actividad_id) DO NOTHING`;
    await this.prisma.db.$queryRaw`
      SELECT id FROM progreso_actividad
      WHERE docente_id = ${teacherId}::uuid AND actividad_id = ${activityId}::uuid FOR UPDATE`;
    const row = await this.prisma.db.activityProgress.findUniqueOrThrow({
      where: { teacherId_activityId: { teacherId, activityId } },
    });
    return toActivityProgress(row);
  }

  async updateModuleProgress(
    id: string,
    changes: ModuleProgressChanges,
  ): Promise<ModuleProgressRecord> {
    const row = await this.prisma.db.moduleProgress.update({
      where: { id },
      data: {
        videoViewedAt: changes.videoViewedAt,
        presentationViewedAt: changes.presentationViewedAt,
        bestScore: changes.bestScore,
        passedAt: changes.passedAt,
        completedAt: changes.completedAt,
        challengeGame: jsonValue(changes.challengeGame),
      },
    });
    return toModuleProgress(row);
  }

  async updateActivityProgress(
    id: string,
    changes: ActivityProgressChanges,
  ): Promise<ActivityProgressRecord> {
    const row = await this.prisma.db.activityProgress.update({
      where: { id },
      data: {
        completedAt: changes.completedAt,
        bestScore: changes.bestScore,
        bestPoints: changes.bestPoints,
        attempts: changes.attempts,
        detail: jsonValue(changes.detail),
        game: jsonValue(changes.game),
      },
    });
    return toActivityProgress(row);
  }

  async insertAttempt(
    progressId: string,
    score: number,
    points: number,
    date: Date,
  ): Promise<string> {
    const row = await this.prisma.db.challengeAttempt.create({
      data: { progressId, score, points, date },
      select: { id: true },
    });
    return row.id;
  }

  async maxChallengePoints(progressId: string): Promise<number | null> {
    const result = await this.prisma.db.challengeAttempt.aggregate({
      where: { progressId },
      _max: { points: true },
    });
    return result._max.points;
  }

  async completionSnapshot(
    teacherId: string,
    moduleId: string,
  ): Promise<CompletionSnapshot | null> {
    const module = await this.prisma.db.trainingModule.findUnique({
      where: { id: moduleId },
      include: {
        _count: { select: { slides: true, questions: true } },
        progress: { where: { teacherId } },
        activities: {
          where: { status: TrainingActivityStatus.Active, isRequired: true },
          select: { id: true, progress: { where: { teacherId }, select: { completedAt: true } } },
        },
      },
    });
    if (!module) {
      return null;
    }
    const progress = module.progress[0];
    return {
      moduleCompletedAt: progress?.completedAt ?? null,
      videoUrl: module.videoUrl,
      videoFileId: module.videoFileId,
      presentationUrl: module.presentationUrl,
      presentationFileId: module.presentationFileId,
      slideCount: module._count.slides,
      questionCount: module._count.questions,
      videoViewedAt: progress?.videoViewedAt ?? null,
      presentationViewedAt: progress?.presentationViewedAt ?? null,
      passedAt: progress?.passedAt ?? null,
      requiredActivities: module.activities.map((activity) => ({
        id: activity.id,
        completedAt: activity.progress[0]?.completedAt ?? null,
      })),
    };
  }

  async listModuleProgress(
    teacherId: string,
    moduleIds: readonly string[],
  ): Promise<ModuleProgressView[]> {
    const rows = await this.prisma.db.moduleProgress.findMany({
      where: { teacherId, moduleId: { in: [...moduleIds] } },
      include: { attempts: { select: { points: true } } },
    });
    return rows.map((row) => ({
      ...toModuleProgress(row),
      attempts: row.attempts.length,
      bestPoints: row.attempts.length ? Math.max(...row.attempts.map((a) => a.points)) : null,
    }));
  }

  async listActivityProgress(
    teacherId: string,
    activityIds: readonly string[],
  ): Promise<ActivityProgressRecord[]> {
    const rows = await this.prisma.db.activityProgress.findMany({
      where: { teacherId, activityId: { in: [...activityIds] } },
    });
    return rows.map(toActivityProgress);
  }
}
