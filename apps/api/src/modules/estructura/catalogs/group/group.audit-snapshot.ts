import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../../core/audit/audit-snapshot';
import { GroupsService } from './groups.service';

/** Estado del grupo para la bitácora; delega en la lectura del servicio. */
@Injectable()
export class GroupAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly groups: GroupsService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    const group = await this.groups.find(id);
    return group ? { ...group } : null;
  }
}
