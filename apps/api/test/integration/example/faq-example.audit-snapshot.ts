import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../src/core/audit/audit-snapshot';
import { FaqExampleService } from './faq-example.service';

/** Fuente de datos antes/después de la bitácora: reutiliza la lectura del servicio. */
@Injectable()
export class FaqExampleAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly service: FaqExampleService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    const entry = await this.service.find(id);
    return entry ? { ...entry } : null;
  }
}
