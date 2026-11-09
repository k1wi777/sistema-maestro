import { Injectable } from '@nestjs/common';
import type { CreateLessonPlanResourceInput, LessonPlanResource } from '@gns/shared';
import type { LessonPlanResource as ResourceRow } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import type { LessonPlanResourceRepository } from './lesson-plan-resource.repository';

function toEntity(row: ResourceRow): LessonPlanResource {
  return {
    id: row.id,
    tool: row.tool,
    name: row.name,
    url: row.url,
    moment: row.moment,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class PrismaLessonPlanResourceRepository implements LessonPlanResourceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPlan(lessonPlanId: string): Promise<LessonPlanResource[]> {
    const rows = await this.prisma.db.lessonPlanResource.findMany({
      where: { lessonPlanId },
      orderBy: [{ moment: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toEntity);
  }

  async findInPlan(lessonPlanId: string, resourceId: string): Promise<LessonPlanResource | null> {
    const row = await this.prisma.db.lessonPlanResource.findFirst({
      where: { id: resourceId, lessonPlanId },
    });
    return row ? toEntity(row) : null;
  }

  countByPlan(lessonPlanId: string): Promise<number> {
    return this.prisma.db.lessonPlanResource.count({ where: { lessonPlanId } });
  }

  async create(
    lessonPlanId: string,
    input: CreateLessonPlanResourceInput,
  ): Promise<LessonPlanResource> {
    const row = await this.prisma.db.lessonPlanResource.create({
      data: {
        lessonPlanId,
        tool: input.tool,
        name: input.name,
        url: input.url,
        moment: input.moment,
      },
    });
    return toEntity(row);
  }

  async delete(resourceId: string): Promise<void> {
    await this.prisma.db.lessonPlanResource.delete({ where: { id: resourceId } });
  }
}
