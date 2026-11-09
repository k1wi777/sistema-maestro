import { Injectable } from '@nestjs/common';
import {
  LESSON_PLAN_ADJUSTABLE_FIELDS,
  RecordStatus,
  type LessonPlan,
  type LessonPlanAdjustableField,
  type LessonPlanFilters,
  type LessonPlanSortField,
} from '@gns/shared';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  PrismaReadRepository,
  type ModelDelegate,
  type OrderByClause,
} from '../../../shared/repository/prisma-read.repository';
import type {
  DeliveredCount,
  DeliveredFilters,
  LessonPlanChanges,
  LessonPlanContent,
  LessonPlanRecord,
  LessonPlanRepository,
  NewLessonPlan,
} from './lesson-plan.repository';

// Datos anidados que evitan que el cliente cruce varios catálogos; nunca el correo del docente.
const INCLUDE = {
  teacher: { select: { id: true, fullName: true } },
  grade: { include: { level: { select: { id: true, name: true } } } },
  area: { select: { id: true, name: true } },
  period: { select: { id: true, number: true, schoolYear: true } },
  linkedResources: {
    orderBy: [{ moment: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.LessonPlanInclude;

type LessonPlanRow = Prisma.LessonPlanGetPayload<{ include: typeof INCLUDE }>;

const DATE_FIELDS: readonly string[] = ['dateFrom', 'dateTo'];
const CONTENT_KEYS = Object.keys(LESSON_PLAN_ADJUSTABLE_FIELDS) as LessonPlanAdjustableField[];

const toDay = (value: Date | null): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

/** Contenido como columnas de Prisma: las fechas `AAAA-MM-DD` pasan a `Date`; `undefined` no se toca. */
function toContentData(content: LessonPlanContent): Record<string, string | Date | null> {
  const data: Record<string, string | Date | null> = {};
  for (const key of CONTENT_KEYS) {
    const value = content[key];
    if (value !== undefined) {
      data[key] = DATE_FIELDS.includes(key) && value ? new Date(value) : value;
    }
  }
  return data;
}

@Injectable()
export class PrismaLessonPlanRepository
  extends PrismaReadRepository<
    LessonPlanRow,
    Prisma.LessonPlanWhereInput,
    LessonPlan,
    LessonPlanFilters,
    LessonPlanSortField
  >
  implements LessonPlanRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findRecordById(id: string): Promise<LessonPlanRecord | null> {
    const row = await this.prisma.db.lessonPlan.findUnique({ where: { id } });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      teacherId: row.teacherId,
      gradeId: row.gradeId,
      areaId: row.areaId,
      periodId: row.periodId,
      crossCuttingProject: row.crossCuttingProject,
      dateFrom: toDay(row.dateFrom),
      dateTo: toDay(row.dateTo),
      topic: row.topic,
      expectedPerformance: row.expectedPerformance,
      learningCorner: row.learningCorner,
      curiocityStage: row.curiocityStage,
      explorationMoment: row.explorationMoment,
      developmentMoment: row.developmentMoment,
      socializationMoment: row.socializationMoment,
      closingMoment: row.closingMoment,
      resources: row.resources,
      reasonableAdjustments: row.reasonableAdjustments,
      status: row.status as RecordStatus,
      submittedAt: row.submittedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async create(input: NewLessonPlan): Promise<LessonPlan> {
    const { teacherId, gradeId, areaId, periodId, crossCuttingProject, ...content } = input;
    const row = await this.prisma.db.lessonPlan.create({
      data: {
        ...toContentData(content),
        teacherId,
        gradeId,
        areaId,
        periodId,
        crossCuttingProject,
        status: RecordStatus.Draft,
      },
      include: INCLUDE,
    });
    return this.toEntity(row);
  }

  async updateIfStatus(
    id: string,
    from: readonly RecordStatus[],
    changes: LessonPlanChanges,
  ): Promise<boolean> {
    const { periodId, crossCuttingProject, status, submittedAt, ...content } = changes;
    const { count } = await this.prisma.db.lessonPlan.updateMany({
      where: { id, status: { in: [...from] } },
      data: { ...toContentData(content), periodId, crossCuttingProject, status, submittedAt },
    });
    return count === 1;
  }

  async lock(id: string): Promise<void> {
    await this.prisma.db.$queryRaw`SELECT id FROM planeacion WHERE id = ${id}::uuid FOR UPDATE`;
  }

  async countDelivered(filters: DeliveredFilters): Promise<DeliveredCount[]> {
    const groups = await this.prisma.db.lessonPlan.groupBy({
      by: ['teacherId', 'gradeId', 'areaId', 'periodId'],
      where: {
        status: { in: [...filters.statuses] },
        period: { schoolYear: filters.schoolYear },
        teacherId: filters.teacherId,
        periodId: filters.periodId,
      },
      _count: { _all: true },
    });
    return groups.map((group) => ({
      teacherId: group.teacherId,
      gradeId: group.gradeId,
      areaId: group.areaId,
      periodId: group.periodId,
      count: group._count._all,
    }));
  }

  // `ModelDelegate` no admite `include`: se envuelve el delegado para fijarlo en las lecturas.
  protected get delegate(): ModelDelegate<LessonPlanRow, Prisma.LessonPlanWhereInput> {
    const model = this.prisma.db.lessonPlan;
    return {
      findMany: (args) => model.findMany({ ...args, include: INCLUDE }),
      count: (args) => model.count(args),
      findUnique: (args) => model.findUnique({ ...args, include: INCLUDE }),
    };
  }

  protected toWhere(filters: LessonPlanFilters): Prisma.LessonPlanWhereInput {
    return {
      teacherId: filters.teacherId,
      status: filters.status,
      periodId: filters.periodId,
      gradeId: filters.gradeId,
      areaId: filters.areaId,
    };
  }

  // PostgreSQL pone los NULL primero en DESC: sin esto los borradores (nunca enviados)
  // encabezarían la bandeja al ordenar por fecha de envío.
  protected override orderBy(field: LessonPlanSortField, order: 'asc' | 'desc'): OrderByClause {
    return field === 'submittedAt'
      ? { submittedAt: { sort: order, nulls: 'last' } }
      : super.orderBy(field, order);
  }

  protected toEntity(row: LessonPlanRow): LessonPlan {
    return {
      id: row.id,
      teacher: { id: row.teacher.id, fullName: row.teacher.fullName },
      grade: { id: row.grade.id, name: row.grade.name },
      level: { id: row.grade.level.id, name: row.grade.level.name },
      area: { id: row.area.id, name: row.area.name },
      period: { id: row.period.id, number: row.period.number, schoolYear: row.period.schoolYear },
      dateFrom: toDay(row.dateFrom),
      dateTo: toDay(row.dateTo),
      topic: row.topic,
      crossCuttingProject: row.crossCuttingProject,
      expectedPerformance: row.expectedPerformance,
      learningCorner: row.learningCorner,
      curiocityStage: row.curiocityStage,
      explorationMoment: row.explorationMoment,
      developmentMoment: row.developmentMoment,
      socializationMoment: row.socializationMoment,
      closingMoment: row.closingMoment,
      resources: row.resources,
      reasonableAdjustments: row.reasonableAdjustments,
      status: row.status as RecordStatus,
      submittedAt: row.submittedAt,
      linkedResources: row.linkedResources.map((resource) => ({
        id: resource.id,
        tool: resource.tool,
        name: resource.name,
        url: resource.url,
        moment: resource.moment,
        createdAt: resource.createdAt,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
