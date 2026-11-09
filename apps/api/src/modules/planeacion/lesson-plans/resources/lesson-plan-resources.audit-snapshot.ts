import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../../core/audit/audit-snapshot';
import { LessonPlanResourcesService } from './lesson-plan-resources.service';

/**
 * Los enlaces de la planeación de la ruta (`params.id`): el diff de primer nivel de la
 * bitácora deja la lista antes y después, con el enlace agregado o quitado.
 */
@Injectable()
export class LessonPlanResourcesAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly resources: LessonPlanResourcesService) {}

  async load(lessonPlanId: string): Promise<Record<string, unknown> | null> {
    const links = await this.resources.listForAudit(lessonPlanId);
    if (!links) {
      return null;
    }
    return {
      linkedResources: links.map(({ id, tool, name, url, moment }) => ({
        id,
        tool,
        name,
        url,
        moment,
      })),
    };
  }
}
