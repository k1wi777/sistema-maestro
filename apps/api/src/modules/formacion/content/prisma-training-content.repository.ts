import { Injectable } from '@nestjs/common';
import {
  ChallengeQuestionType,
  TrainingActivityStatus,
  type Activity,
  type ChallengeQuestion,
  type ChallengeQuestionInput,
  type CreateActivityInput,
  type CreateSlideInput,
  type Slide,
  type TrainingActivityType,
  type UpdateSlideInput,
} from '@gns/shared';
import type {
  Prisma,
  ChallengeQuestion as QuestionRow,
  QuestionOption as OptionRow,
  Slide as SlideRow,
  TrainingActivity as ActivityRow,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { ActivityChanges, TrainingContentRepository } from './training-content.repository';

const toSlide = (row: SlideRow): Slide => ({
  id: row.id,
  sortOrder: row.sortOrder,
  title: row.title,
  keyIdeas: row.keyIdeas,
});

const toQuestion = (row: QuestionRow & { options: OptionRow[] }): ChallengeQuestion => ({
  id: row.id,
  sortOrder: row.sortOrder,
  type: row.type as ChallengeQuestionType,
  prompt: row.prompt,
  feedback: row.feedback,
  trueFalseAnswer: row.trueFalseAnswer,
  options: [...row.options]
    // Las de ordenar van en su orden correcto; las demás, en el de creación.
    .sort(
      (a, b) =>
        (a.correctPosition ?? 0) - (b.correctPosition ?? 0) ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    )
    .map((option) => ({
      id: option.id,
      text: option.text,
      isCorrect: option.isCorrect,
      correctPosition: option.correctPosition,
    })),
});

const toActivity = (row: ActivityRow): Activity => ({
  id: row.id,
  type: row.type as TrainingActivityType,
  sortOrder: row.sortOrder,
  title: row.title,
  isRequired: row.isRequired,
  instructions: row.instructions,
  status: row.status as TrainingActivityStatus,
  config: row.config as Record<string, unknown>,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const ORDERED = [{ sortOrder: 'asc' }, { id: 'asc' }] as const;

/** Columnas de una pregunta según su tipo: cada dato solo en el tipo que lo usa. */
function optionRows(input: ChallengeQuestionInput) {
  switch (input.type) {
    case ChallengeQuestionType.MultipleChoice:
      return input.options.map((option) => ({
        text: option.text,
        isCorrect: option.isCorrect,
        correctPosition: null,
      }));
    case ChallengeQuestionType.Ordering:
      return input.steps.map((text, index) => ({
        text,
        isCorrect: null,
        correctPosition: index + 1,
      }));
    case ChallengeQuestionType.TrueFalse:
      return [];
  }
}

@Injectable()
export class PrismaTrainingContentRepository implements TrainingContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async lockModule(moduleId: string): Promise<boolean> {
    const rows = await this.prisma.db.$queryRaw<
      { id: string }[]
    >`SELECT id FROM modulo_formacion WHERE id = ${moduleId}::uuid FOR UPDATE`;
    return rows.length > 0;
  }

  // ---------- Diapositivas ----------

  async listSlides(moduleId: string): Promise<Slide[]> {
    const rows = await this.prisma.db.slide.findMany({
      where: { moduleId },
      orderBy: [...ORDERED],
    });
    return rows.map(toSlide);
  }

  async findSlide(moduleId: string, slideId: string): Promise<Slide | null> {
    const row = await this.prisma.db.slide.findFirst({ where: { id: slideId, moduleId } });
    return row ? toSlide(row) : null;
  }

  async createSlide(moduleId: string, input: CreateSlideInput): Promise<Slide> {
    const last = await this.prisma.db.slide.aggregate({
      where: { moduleId },
      _max: { sortOrder: true },
    });
    const row = await this.prisma.db.slide.create({
      data: {
        moduleId,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        title: input.title,
        keyIdeas: input.keyIdeas,
      },
    });
    return toSlide(row);
  }

  async updateSlide(slideId: string, input: UpdateSlideInput): Promise<Slide> {
    const row = await this.prisma.db.slide.update({
      where: { id: slideId },
      data: { title: input.title, keyIdeas: input.keyIdeas },
    });
    return toSlide(row);
  }

  async deleteSlide(slideId: string): Promise<void> {
    await this.prisma.db.slide.delete({ where: { id: slideId } });
  }

  async listSlideIds(moduleId: string): Promise<string[]> {
    const rows = await this.prisma.db.slide.findMany({ where: { moduleId }, select: { id: true } });
    return rows.map((row) => row.id);
  }

  async setSlideOrder(ids: readonly string[]): Promise<void> {
    for (const [index, id] of ids.entries()) {
      await this.prisma.db.slide.update({ where: { id }, data: { sortOrder: index + 1 } });
    }
  }

  // ---------- Preguntas ----------

  async listQuestions(moduleId: string): Promise<ChallengeQuestion[]> {
    const rows = await this.prisma.db.challengeQuestion.findMany({
      where: { moduleId },
      orderBy: [...ORDERED],
      include: { options: true },
    });
    return rows.map(toQuestion);
  }

  async findQuestion(moduleId: string, questionId: string): Promise<ChallengeQuestion | null> {
    const row = await this.prisma.db.challengeQuestion.findFirst({
      where: { id: questionId, moduleId },
      include: { options: true },
    });
    return row ? toQuestion(row) : null;
  }

  async createQuestion(
    moduleId: string,
    input: ChallengeQuestionInput,
  ): Promise<ChallengeQuestion> {
    const last = await this.prisma.db.challengeQuestion.aggregate({
      where: { moduleId },
      _max: { sortOrder: true },
    });
    const row = await this.prisma.db.challengeQuestion.create({
      data: {
        moduleId,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        type: input.type,
        prompt: input.prompt,
        feedback: input.feedback,
        trueFalseAnswer:
          input.type === ChallengeQuestionType.TrueFalse ? input.trueFalseAnswer : null,
        options: { create: optionRows(input) },
      },
      include: { options: true },
    });
    return toQuestion(row);
  }

  async replaceQuestion(
    questionId: string,
    input: ChallengeQuestionInput,
  ): Promise<ChallengeQuestion> {
    await this.prisma.db.questionOption.deleteMany({ where: { questionId } });
    const row = await this.prisma.db.challengeQuestion.update({
      where: { id: questionId },
      data: {
        type: input.type,
        prompt: input.prompt,
        feedback: input.feedback,
        trueFalseAnswer:
          input.type === ChallengeQuestionType.TrueFalse ? input.trueFalseAnswer : null,
        options: { create: optionRows(input) },
      },
      include: { options: true },
    });
    return toQuestion(row);
  }

  async deleteQuestion(questionId: string): Promise<void> {
    await this.prisma.db.questionOption.deleteMany({ where: { questionId } });
    await this.prisma.db.challengeQuestion.delete({ where: { id: questionId } });
  }

  async listQuestionIds(moduleId: string): Promise<string[]> {
    const rows = await this.prisma.db.challengeQuestion.findMany({
      where: { moduleId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async setQuestionOrder(ids: readonly string[]): Promise<void> {
    for (const [index, id] of ids.entries()) {
      await this.prisma.db.challengeQuestion.update({
        where: { id },
        data: { sortOrder: index + 1 },
      });
    }
  }

  // ---------- Actividades ----------

  async listActivities(moduleId: string): Promise<Activity[]> {
    const rows = await this.prisma.db.trainingActivity.findMany({
      where: { moduleId },
      orderBy: [...ORDERED],
    });
    return rows.map(toActivity);
  }

  async findActivity(moduleId: string, activityId: string): Promise<Activity | null> {
    const row = await this.prisma.db.trainingActivity.findFirst({
      where: { id: activityId, moduleId },
    });
    return row ? toActivity(row) : null;
  }

  async createActivity(moduleId: string, input: CreateActivityInput): Promise<Activity> {
    const last = await this.prisma.db.trainingActivity.aggregate({
      where: { moduleId },
      _max: { sortOrder: true },
    });
    const row = await this.prisma.db.trainingActivity.create({
      data: {
        moduleId,
        type: input.type,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        title: input.title,
        isRequired: input.isRequired,
        instructions: input.instructions,
        status: TrainingActivityStatus.Active,
        config: input.config as Prisma.InputJsonObject,
      },
    });
    return toActivity(row);
  }

  async updateActivity(activityId: string, changes: ActivityChanges): Promise<Activity> {
    const row = await this.prisma.db.trainingActivity.update({
      where: { id: activityId },
      data: {
        title: changes.title,
        isRequired: changes.isRequired,
        instructions: changes.instructions,
        config: changes.config as Prisma.InputJsonObject | undefined,
      },
    });
    return toActivity(row);
  }

  async setActivityStatus(activityId: string, status: TrainingActivityStatus): Promise<Activity> {
    const row = await this.prisma.db.trainingActivity.update({
      where: { id: activityId },
      data: { status },
    });
    return toActivity(row);
  }

  async listActivityIds(moduleId: string): Promise<string[]> {
    const rows = await this.prisma.db.trainingActivity.findMany({
      where: { moduleId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async setActivityOrder(ids: readonly string[]): Promise<void> {
    for (const [index, id] of ids.entries()) {
      await this.prisma.db.trainingActivity.update({
        where: { id },
        data: { sortOrder: index + 1 },
      });
    }
  }
}
