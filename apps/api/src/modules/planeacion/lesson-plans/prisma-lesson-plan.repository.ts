import { Injectable } from '@nestjs/common';
import {
  LESSON_PLAN_ADJUSTABLE_FIELDS,
  RecordStatus,
  type LessonPlan,
  type LessonPlanAdjustableField,
  type LessonPlanFilters,
  type LessonPlanSortField,
} from '@gns/shared';
import { Prisma } from '../../../generated/prisma/client';
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
  areas: { include: { area: { select: { id: true, name: true } } } },
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
    const row = await this.prisma.db.lessonPlan.findUnique({
      where: { id },
      include: { areas: { select: { areaId: true } } },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      teacherId: row.teacherId,
      gradeId: row.gradeId,
      areaIds: row.areas.map((entry) => entry.areaId).sort(),
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
    const { teacherId, gradeId, areaIds, periodId, crossCuttingProject, ...content } = input;
    const row = await this.prisma.db.lessonPlan.create({
      data: {
        ...toContentData(content),
        teacherId,
        gradeId,
        periodId,
        crossCuttingProject,
        status: RecordStatus.Draft,
        areas: { create: areaIds.map((areaId) => ({ areaId })) },
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
    const { periodId, areaIds, crossCuttingProject, status, submittedAt, ...content } = changes;
    const { count } = await this.prisma.db.lessonPlan.updateMany({
      where: { id, status: { in: [...from] } },
      data: {
        ...toContentData(content),
        periodId,
        crossCuttingProject,
        status,
        submittedAt,
        // Un cambio solo de áreas no toca columnas de la fila: se fija la fecha a mano.
        ...(areaIds ? { updatedAt: new Date() } : {}),
      },
    });
    if (count !== 1) {
      return false;
    }
    if (areaIds) {
      // Misma transacción de la petición (`this.prisma.db`): quita las retiradas y añade las nuevas.
      await this.prisma.db.lessonPlanArea.deleteMany({
        where: { lessonPlanId: id, areaId: { notIn: areaIds } },
      });
      await this.prisma.db.lessonPlanArea.createMany({
        data: areaIds.map((areaId) => ({ lessonPlanId: id, areaId })),
        skipDuplicates: true,
      });
    }
    return true;
  }

  async lock(id: string): Promise<void> {
    await this.prisma.db.$queryRaw`SELECT id FROM planeacion WHERE id = ${id}::uuid FOR UPDATE`;
  }

  // `groupBy` no agrupa por campos de otra tabla: se une `planeacion_area` en SQL parametrizado,
  // así una planeación con varias áreas cuenta una vez en cada una.
  async countDelivered(filters: DeliveredFilters): Promise<DeliveredCount[]> {
    const rows = await this.prisma.db.$queryRaw<
      { teacher_id: string; grade_id: string; area_id: string; period_id: string; total: bigint }[]
    >(Prisma.sql`
      SELECT p.docente_id AS teacher_id, p.grado_id AS grade_id, pa.area_id AS area_id,
             p.periodo_id AS period_id, count(*) AS total
      FROM planeacion p
      JOIN planeacion_area pa ON pa.planeacion_id = p.id
      JOIN periodo_academico per ON per.id = p.periodo_id
      WHERE p.estado IN (${Prisma.join([...filters.statuses])})
        AND per.anio_lectivo = ${filters.schoolYear}
        ${filters.teacherId ? Prisma.sql`AND p.docente_id = ${filters.teacherId}::uuid` : Prisma.empty}
        ${filters.periodId ? Prisma.sql`AND p.periodo_id = ${filters.periodId}::uuid` : Prisma.empty}
      GROUP BY p.docente_id, p.grado_id, pa.area_id, p.periodo_id`);
    return rows.map((row) => ({
      teacherId: row.teacher_id,
      gradeId: row.grade_id,
      areaId: row.area_id,
      periodId: row.period_id,
      count: Number(row.total),
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
      areas: filters.areaId ? { some: { areaId: filters.areaId } } : undefined,
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
      areas: row.areas
        .map((entry) => ({ id: entry.area.id, name: entry.area.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
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
