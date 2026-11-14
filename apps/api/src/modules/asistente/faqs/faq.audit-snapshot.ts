import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../core/audit/audit-snapshot';
import { FaqsService } from './faqs.service';

/** Pregunta frecuente completa: son textos institucionales, sin nada que ocultar. */
@Injectable()
export class FaqAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly faqs: FaqsService) {}

  load(id: string): Promise<Record<string, unknown> | null> {
    return this.faqs.forAudit(id);
  }
}
