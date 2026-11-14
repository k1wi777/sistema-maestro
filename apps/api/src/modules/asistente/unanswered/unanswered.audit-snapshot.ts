import { Injectable } from '@nestjs/common';
import type { AuditSnapshotSource } from '../../../core/audit/audit-snapshot';
import { UnansweredService } from './unanswered.service';

/**
 * Estado del grupo (estado, contadores, cierre y enlace) para la bitácora. Lee solo la fila del
 * grupo: la lista de autores no hace falta y el texto se oculta con `redact` en el controlador.
 */
@Injectable()
export class UnansweredQuestionAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly unanswered: UnansweredService) {}

  load(id: string): Promise<Record<string, unknown> | null> {
    return this.unanswered.forAudit(id);
  }
}
