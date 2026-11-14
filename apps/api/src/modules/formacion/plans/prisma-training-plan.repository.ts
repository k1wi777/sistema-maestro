import { Injectable } from '@nestjs/common';
import {
  describeModuleVideo,
  TrainingActivityStatus,
  TrainingModuleStatus,
  type CreateTrainingModuleInput,
  type CreateTrainingPlanInput,
  type CreateTrainingSectionInput,
  type TrainingModule,
  type TrainingPlan,
  type TrainingPlanSummary,
  type TrainingSection,
  type TrainingSectionWithModules,
  type UpdateTrainingModuleInput,
  type UpdateTrainingPlanInput,
  type UpdateTrainingSectionInput,
} from '@gns/shared';
import type {
  Prisma,
  StoredFile as FileRow,
  TrainingPlan as PlanRow,
  TrainingSection as SectionRow,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import type {
  ActivityScopeRow,
  ModuleContentCounts,
  RouteActivityRow,
  RoutePlanRow,
  TeacherModuleRow,
  TrainingPlanRepository,
} from './training-plan.repository';

const toPlan = (row: PlanRow): TrainingPlan => ({
  id: row.id,
  areaId: row.areaId,
  name: row.name,
  schoolYear: row.schoolYear,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toSection = (row: SectionRow): TrainingSection => ({
  id: row.id,
  planId: row.planId,
  title: row.title,
  subtitle: row.subtitle,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** El módulo de coordinación trae sus dos archivos (solo metadatos, sin URL). */
const MODULE_FILES_INCLUDE = {
  videoFile: true,
  presentationFile: true,
} satisfies Prisma.TrainingModuleInclude;

type ModuleRow = Prisma.TrainingModuleGetPayload<{ include: typeof MODULE_FILES_INCLUDE }>;

const toFileSummary = (row: FileRow | null) =>
  row
    ? {
        id: row.id,
        name: row.originalName,
        contentType: row.contentType,
        size: Number(row.sizeBytes),
      }
    : null;

const toModule = (row: ModuleRow): TrainingModule => ({
  id: row.id,
  planId: row.planId,
  sectionId: row.sectionId,
  number: row.number,
  sortOrder: row.sortOrder,
  title: row.title,
  summary: row.summary,
  videoUrl: row.videoUrl,
  videoTitle: row.videoTitle,
  presentationUrl: row.presentationUrl,
  ...describeModuleVideo(row.videoUrl, row.videoFile !== null),
  videoFile: toFileSummary(row.videoFile),
  presentationFile: toFileSummary(row.presentationFile),
  status: row.status as TrainingModuleStatus,
  approvalThreshold: row.approvalThreshold,
  secondsPerQuestion: row.secondsPerQuestion,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const ACTIVE_ACTIVITIES = {
  where: { status: TrainingActivityStatus.Active },
  orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  select: {
    id: true,
    type: true,
    title: true,
    isRequired: true,
    instructions: true,
    sortOrder: true,
    config: true,
    updatedAt: true,
    moduleId: true,
    status: true,
  },
} satisfies Prisma.TrainingModule$activitiesArgs;

type ActivityRow = {
  id: string;
  type: string;
  title: string;
  isRequired: boolean;
  instructions: string | null;
  sortOrder: number;
  config: unknown;
  updatedAt: Date;
};

const toRouteActivity = (row: ActivityRow): RouteActivityRow => ({
  id: row.id,
  type: row.type,
  title: row.title,
  isRequired: row.isRequired,
  instructions: row.instructions,
  sortOrder: row.sortOrder,
  config: row.config,
  updatedAt: row.updatedAt,
});

/** Un módulo de ruta: todos los hijos se traen en la misma consulta del plan, sin N+1. */
const ROUTE_MODULE_INCLUDE = {
  _count: { select: { slides: true, questions: true } },
  videoFile: true,
  presentationFile: true,
  activities: ACTIVE_ACTIVITIES,
} satisfies Prisma.TrainingModuleInclude;

@Injectable()
export class PrismaTrainingPlanRepository implements TrainingPlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Planes ----------

  async listPlans(): Promise<TrainingPlanSummary[]> {
    const plans = await this.prisma.db.trainingPlan.findMany({
      include: { area: { select: { name: true } } },
      orderBy: [{ areaId: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }, { id: 'asc' }],
    });
    const grouped = await this.prisma.db.trainingModule.groupBy({
      by: ['planId', 'status'],
      _count: { _all: true },
    });
    return plans.map((plan) => {
      const count = (status: TrainingModuleStatus): number =>
        grouped.find((row) => row.planId === plan.id && row.status === status)?._count._all ?? 0;
      return {
        ...toPlan(plan),
        areaName: plan.area?.name ?? null,
        moduleCounts: {
          draft: count(TrainingModuleStatus.Draft),
          active: count(TrainingModuleStatus.Active),
          outOfPlan: count(TrainingModuleStatus.OutOfPlan),
        },
      };
    });
  }

  async findPlan(id: string): Promise<TrainingPlan | null> {
    const row = await this.prisma.db.trainingPlan.findUnique({ where: { id } });
    return row ? toPlan(row) : null;
  }

  async findPlanByAreaAndYear(
    areaId: string | null,
    schoolYear: string | null,
  ): Promise<TrainingPlan | null> {
    const row = await this.prisma.db.trainingPlan.findFirst({
      where: { areaId, schoolYear },
      orderBy: { id: 'asc' },
    });
    return row ? toPlan(row) : null;
  }

  async lockPlanCreation(): Promise<void> {
    // `$executeRaw`: Prisma no sabe leer el `void` que devuelve el candado.
    await this.prisma.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gns_training_plan'))`;
  }

  async lockPlan(id: string): Promise<void> {
    await this.prisma.db.$queryRaw`SELECT id FROM plan_formacion WHERE id = ${id}::uuid FOR UPDATE`;
  }

  async createPlan(input: CreateTrainingPlanInput): Promise<TrainingPlan> {
    const row = await this.prisma.db.trainingPlan.create({
      data: { name: input.name, areaId: input.areaId, schoolYear: input.schoolYear },
    });
    return toPlan(row);
  }

  async updatePlan(id: string, input: UpdateTrainingPlanInput): Promise<TrainingPlan> {
    const row = await this.prisma.db.trainingPlan.update({
      where: { id },
      data: { name: input.name, schoolYear: input.schoolYear },
    });
    return toPlan(row);
  }

  // ---------- Secciones ----------

  async findSection(id: string): Promise<TrainingSection | null> {
    const row = await this.prisma.db.trainingSection.findUnique({ where: { id } });
    return row ? toSection(row) : null;
  }

  async listSectionsWithModules(planId: string): Promise<TrainingSectionWithModules[]> {
    const sections = await this.prisma.db.trainingSection.findMany({
      where: { planId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        modules: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { _count: { select: { slides: true, questions: true, activities: true } } },
        },
      },
    });
    return sections.map((section) => ({
      ...toSection(section),
      modules: section.modules.map((module) => ({
        id: module.id,
        number: module.number,
        sortOrder: module.sortOrder,
        title: module.title,
        status: module.status as TrainingModuleStatus,
        slideCount: module._count.slides,
        questionCount: module._count.questions,
        activityCount: module._count.activities,
      })),
    }));
  }

  async lockSection(id: string): Promise<void> {
    await this.prisma.db.$queryRaw`SELECT id FROM seccion_plan WHERE id = ${id}::uuid FOR UPDATE`;
  }

  async createSection(planId: string, input: CreateTrainingSectionInput): Promise<TrainingSection> {
    const last = await this.prisma.db.trainingSection.aggregate({
      where: { planId },
      _max: { sortOrder: true },
    });
    const row = await this.prisma.db.trainingSection.create({
      data: {
        planId,
        title: input.title,
        subtitle: input.subtitle,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
      },
    });
    return toSection(row);
  }

  async updateSection(id: string, input: UpdateTrainingSectionInput): Promise<TrainingSection> {
    const row = await this.prisma.db.trainingSection.update({
      where: { id },
      data: { title: input.title, subtitle: input.subtitle },
    });
    return toSection(row);
  }

  async deleteSection(id: string): Promise<void> {
    await this.prisma.db.trainingSection.delete({ where: { id } });
  }

  countModulesInSection(sectionId: string): Promise<number> {
    return this.prisma.db.trainingModule.count({ where: { sectionId } });
  }

  async listSectionIds(planId: string): Promise<string[]> {
    const rows = await this.prisma.db.trainingSection.findMany({
      where: { planId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async setSectionOrder(ids: readonly string[]): Promise<void> {
    for (const [index, id] of ids.entries()) {
      await this.prisma.db.trainingSection.update({
        where: { id },
        data: { sortOrder: index + 1 },
      });
    }
  }

  // ---------- Módulos ----------

  async findModule(id: string): Promise<TrainingModule | null> {
    const row = await this.prisma.db.trainingModule.findUnique({
      where: { id },
      include: MODULE_FILES_INCLUDE,
    });
    return row ? toModule(row) : null;
  }

  async lockModule(id: string): Promise<void> {
    await this.prisma.db
      .$queryRaw`SELECT id FROM modulo_formacion WHERE id = ${id}::uuid FOR UPDATE`;
  }

  private async nextModuleOrder(sectionId: string): Promise<number> {
    const last = await this.prisma.db.trainingModule.aggregate({
      where: { sectionId },
      _max: { sortOrder: true },
    });
    return (last._max.sortOrder ?? 0) + 1;
  }

  async createModule(
    section: TrainingSection,
    input: CreateTrainingModuleInput,
  ): Promise<TrainingModule> {
    const row = await this.prisma.db.trainingModule.create({
      data: {
        planId: section.planId,
        sectionId: section.id,
        sortOrder: await this.nextModuleOrder(section.id),
        status: TrainingModuleStatus.Draft,
        number: input.number,
        title: input.title,
        summary: input.summary,
        videoUrl: input.videoUrl,
        videoTitle: input.videoTitle,
        presentationUrl: input.presentationUrl,
        approvalThreshold: input.approvalThreshold,
        secondsPerQuestion: input.secondsPerQuestion,
      },
      include: MODULE_FILES_INCLUDE,
    });
    return toModule(row);
  }

  async updateModule(
    id: string,
    input: Omit<UpdateTrainingModuleInput, 'sectionId'>,
  ): Promise<TrainingModule> {
    const row = await this.prisma.db.trainingModule.update({
      where: { id },
      data: {
        number: input.number,
        title: input.title,
        summary: input.summary,
        videoUrl: input.videoUrl,
        videoTitle: input.videoTitle,
        presentationUrl: input.presentationUrl,
        // Enlace y archivo del mismo propósito se excluyen: fijar el enlace quita el archivo (R6).
        // El archivo queda en el almacenamiento y en `archivo`, solo se desasocia.
        videoFileId: input.videoUrl ? null : undefined,
        presentationFileId: input.presentationUrl ? null : undefined,
        approvalThreshold: input.approvalThreshold,
        secondsPerQuestion: input.secondsPerQuestion,
      },
      include: MODULE_FILES_INCLUDE,
    });
    return toModule(row);
  }

  async moveModule(id: string, sectionId: string): Promise<TrainingModule> {
    const row = await this.prisma.db.trainingModule.update({
      where: { id },
      data: { sectionId, sortOrder: await this.nextModuleOrder(sectionId) },
      include: MODULE_FILES_INCLUDE,
    });
    return toModule(row);
  }

  async listModuleIds(sectionId: string): Promise<string[]> {
    const rows = await this.prisma.db.trainingModule.findMany({
      where: { sectionId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async setModuleOrder(ids: readonly string[]): Promise<void> {
    for (const [index, id] of ids.entries()) {
      await this.prisma.db.trainingModule.update({ where: { id }, data: { sortOrder: index + 1 } });
    }
  }

  async setModuleStatus(id: string, status: TrainingModuleStatus): Promise<TrainingModule> {
    const row = await this.prisma.db.trainingModule.update({
      where: { id },
      data: { status },
      include: MODULE_FILES_INCLUDE,
    });
    return toModule(row);
  }

  async countContent(moduleId: string): Promise<ModuleContentCounts> {
    const [slides, questions, activeActivities] = await Promise.all([
      this.prisma.db.slide.count({ where: { moduleId } }),
      this.prisma.db.challengeQuestion.count({ where: { moduleId } }),
      this.prisma.db.trainingActivity.count({
        where: { moduleId, status: TrainingActivityStatus.Active },
      }),
    ]);
    return { slides, questions, activeActivities };
  }

  // ---------- Ruta del docente ----------

  async findRoutePlans(areaIds: readonly string[], schoolYear: string): Promise<RoutePlanRow[]> {
    const plans = await this.prisma.db.trainingPlan.findMany({
      where: {
        OR: [{ areaId: null }, { areaId: { in: [...areaIds] } }],
        AND: [{ OR: [{ schoolYear: null }, { schoolYear }] }],
      },
      include: {
        area: { select: { name: true } },
        sections: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            modules: {
              where: { status: TrainingModuleStatus.Active },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: ROUTE_MODULE_INCLUDE,
            },
          },
        },
      },
    });
    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      areaId: plan.areaId,
      areaName: plan.area?.name ?? null,
      schoolYear: plan.schoolYear,
      sections: plan.sections.map((section) => ({
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        sortOrder: section.sortOrder,
        modules: section.modules.map((module) => ({
          id: module.id,
          number: module.number,
          title: module.title,
          summary: module.summary,
          sortOrder: module.sortOrder,
          videoUrl: module.videoUrl,
          presentationUrl: module.presentationUrl,
          videoFile: toFileSummary(module.videoFile),
          presentationFile: toFileSummary(module.presentationFile),
          slideCount: module._count.slides,
          questionCount: module._count.questions,
          activities: module.activities.map(toRouteActivity),
        })),
      })),
    }));
  }

  async findTeacherModule(moduleId: string): Promise<TeacherModuleRow | null> {
    const row = await this.prisma.db.trainingModule.findUnique({
      where: { id: moduleId },
      include: {
        ...ROUTE_MODULE_INCLUDE,
        plan: { select: { areaId: true, schoolYear: true } },
        section: { select: { title: true } },
        slides: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      number: row.number,
      title: row.title,
      summary: row.summary,
      sortOrder: row.sortOrder,
      videoUrl: row.videoUrl,
      presentationUrl: row.presentationUrl,
      videoFile: toFileSummary(row.videoFile),
      presentationFile: toFileSummary(row.presentationFile),
      slideCount: row._count.slides,
      questionCount: row._count.questions,
      activities: row.activities.map(toRouteActivity),
      status: row.status as TrainingModuleStatus,
      planId: row.planId,
      planAreaId: row.plan.areaId,
      planSchoolYear: row.plan.schoolYear,
      sectionId: row.sectionId,
      sectionTitle: row.section.title,
      videoTitle: row.videoTitle,
      approvalThreshold: row.approvalThreshold,
      secondsPerQuestion: row.secondsPerQuestion,
      slides: row.slides.map((slide) => ({
        id: slide.id,
        title: slide.title,
        keyIdeas: slide.keyIdeas,
      })),
    };
  }

  async findActivityScope(activityId: string): Promise<ActivityScopeRow | null> {
    const row = await this.prisma.db.trainingActivity.findUnique({
      where: { id: activityId },
      include: { module: { include: { plan: { select: { areaId: true, schoolYear: true } } } } },
    });
    if (!row) {
      return null;
    }
    return {
      activity: { ...toRouteActivity(row), moduleId: row.moduleId, status: row.status },
      moduleStatus: row.module.status as TrainingModuleStatus,
      planAreaId: row.module.plan.areaId,
      planSchoolYear: row.module.plan.schoolYear,
    };
  }
}
