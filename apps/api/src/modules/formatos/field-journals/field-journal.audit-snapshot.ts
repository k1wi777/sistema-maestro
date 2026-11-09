import { Injectable } from '@nestjs/common';
import { AuditLogType } from '@gns/shared';
import type { AuditSnapshotSource } from '../../../core/audit/audit-snapshot';
import { FieldJournalsService } from './field-journals.service';

/** Estado de la hoja para la bitácora: los campos de su fila y de sus entradas, sin relaciones. */
@Injectable()
export class FieldJournalAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly journals: FieldJournalsService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    return this.journals.findRaw(id);
  }
}

/**
 * Opciones de `@Audited` comunes a toda escritura del diario (también las de coordinación).
 * `redact` oculta nombres de estudiantes y textos libres: la bitácora es inmutable y no debe
 * retener datos de menores; el contenido vive en la hoja y en el historial de revisión.
 */
export const FIELD_JOURNAL_AUDIT = {
  type: AuditLogType.FieldJournal,
  entity: 'diario_campo',
  snapshot: FieldJournalAuditSnapshot,
  redact: ['studentNames', 'description', 'actions', 'reflection'],
};
