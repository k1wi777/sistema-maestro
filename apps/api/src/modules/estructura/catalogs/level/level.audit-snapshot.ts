import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../../core/audit/audit-snapshot';
import { LevelsService } from './levels.service';

/** Estado del nivel para la bitácora; delega en la lectura del servicio. */
@Injectable()
export class LevelAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly levels: LevelsService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    const level = await this.levels.find(id);
    return level ? { ...level } : null;
  }
}
