import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../core/audit/audit-snapshot';
import { SchoolYearsService } from './school-years.service';

/** Estado del año lectivo para la bitácora; delega en la lectura del servicio. */
@Injectable()
export class SchoolYearAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly schoolYears: SchoolYearsService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    const year = await this.schoolYears.find(id);
    return year ? { ...year } : null;
  }
}
