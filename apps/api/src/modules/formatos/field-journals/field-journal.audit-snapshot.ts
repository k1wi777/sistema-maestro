import { Injectable } from '@nestjs/common';
import { AuditLogType } from '@gns/shared';
import type { AuditSnapshotSource } from '../../../core/audit/audit-snapshot';
import { FieldJournalsService } from './field-journals.service';

/** Estado del diario para la bitácora: su fila, sus anotaciones y observaciones, sin relaciones. */
@Injectable()
export class FieldJournalAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly journals: FieldJournalsService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    return this.journals.findRaw(id);
  }

  /** «Transition 1 · 2026-11-09 · 4 de 5 aportes»: grupo, fecha y aportes; nunca textos. */
  describe(snapshot: Record<string, unknown>): string | null {
    const { groupName, date, lastSubmission } = snapshot as {
      groupName?: string;
      date?: string;
      lastSubmission?: { readyCount: number; expectedCount: number } | null;
    };
    if (!groupName || !date) {
      return null;
    }
    const counts = lastSubmission
      ? ` · ${lastSubmission.readyCount} de ${lastSubmission.expectedCount} aportes`
      : '';
    return `${groupName} · ${date}${counts}`;
  }
}

/**
 * Opciones de `@Audited` comunes a toda escritura del diario (también las de coordinación).
 * `redact` oculta nombres de estudiantes y textos libres: la bitácora es inmutable y no debe
 * retener datos de menores; el contenido vive en el diario, sus anotaciones y observaciones.
 */
export const FIELD_JOURNAL_AUDIT = {
  type: AuditLogType.FieldJournal,
  entity: 'diario_campo',
  snapshot: FieldJournalAuditSnapshot,
  redact: ['studentNames', 'description', 'actions', 'reflection', 'text', 'comment'],
};
