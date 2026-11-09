import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../../core/audit/audit-snapshot';
import { AreasService } from './areas.service';

/** Estado del área para la bitácora; delega en la lectura del servicio. */
@Injectable()
export class AreaAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly areas: AreasService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    const area = await this.areas.find(id);
    return area ? { ...area } : null;
  }
}
