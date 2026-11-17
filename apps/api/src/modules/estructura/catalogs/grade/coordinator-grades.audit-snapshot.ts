import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../../core/audit/audit-snapshot';
import { GradesService } from './grades.service';

/** Grados de una coordinadora para la bitácora; el id es el de la usuaria. */
@Injectable()
export class CoordinatorGradesAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly grades: GradesService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    return { id, gradeIds: await this.grades.coordinatorGradeIds(id) };
  }
}
