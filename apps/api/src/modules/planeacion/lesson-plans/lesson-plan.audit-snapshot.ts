import { Injectable } from '@nestjs/common';
import { AuditLogType } from '@gns/shared';
import type { AuditSnapshotSource } from '../../../core/audit/audit-snapshot';
import { LessonPlansService } from './lesson-plans.service';

/** Estado de la planeación para la bitácora: los campos de su fila, sin relaciones ni enlaces. */
@Injectable()
export class LessonPlanAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly lessonPlans: LessonPlansService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    return this.lessonPlans.findRaw(id);
  }
}

/** Opciones de `@Audited` comunes a todas las escrituras de planeación (incluidas las de coordinación). */
export const LESSON_PLAN_AUDIT = {
  type: AuditLogType.LessonPlan,
  entity: 'planeacion',
  snapshot: LessonPlanAuditSnapshot,
};
