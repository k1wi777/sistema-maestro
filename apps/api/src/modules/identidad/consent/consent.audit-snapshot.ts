import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../core/audit/audit-snapshot';
import { ConsentService } from './consent.service';

/** Estado de la aceptación para la bitácora: usuario, versión, fecha y casillas. */
@Injectable()
export class ConsentAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly consent: ConsentService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    const record = await this.consent.find(id);
    return record
      ? {
          userId: record.userId,
          policyVersion: record.policyVersion,
          acceptedAt: record.acceptedAt,
          items: record.items,
        }
      : null;
  }
}
