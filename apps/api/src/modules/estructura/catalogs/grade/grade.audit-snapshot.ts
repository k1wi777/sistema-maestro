import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../../core/audit/audit-snapshot';
import { GradesService } from './grades.service';

/** Estado del grado para la bitácora; delega en la lectura del servicio. */
@Injectable()
export class GradeAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly grades: GradesService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    const grade = await this.grades.find(id);
    return grade ? { ...grade } : null;
  }
}
