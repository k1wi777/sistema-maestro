import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../../core/audit/audit-snapshot';
import { AcademicPeriodsService } from './academic-periods.service';

/** Estado del periodo académico para la bitácora; delega en la lectura del servicio. */
@Injectable()
export class AcademicPeriodAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly periods: AcademicPeriodsService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    const period = await this.periods.find(id);
    return period ? { ...period } : null;
  }
}
