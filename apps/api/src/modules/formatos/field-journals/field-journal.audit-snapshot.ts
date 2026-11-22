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
 * Bitácora del descarte de una anotación (y, si era la única, del diario): solo catálogo y
 * estados. La anotación desaparece, así que el detalle sale del estado anterior; nunca incluye
 * textos ni nombres de estudiantes.
 */
@Injectable()
export class JournalAnnotationDiscardSnapshot implements AuditSnapshotSource {
  constructor(private readonly journals: FieldJournalsService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    return this.journals.findAnnotationDiscardSnapshot(id);
  }

  /** «Transition 1 · 2026-11-09 · Lengua Castellana»: grupo, fecha y área. */
  describe(snapshot: Record<string, unknown>): string | null {
    const { group, date, area } = snapshot as { group?: string; date?: string; area?: string };
    return group && date && area ? `${group} · ${date} · ${area}` : null;
  }
}

/**
 * Opciones de `@Audited` comunes a toda escritura del diario (también las de coordinación).
 * `redact` oculta los textos libres (pueden nombrar estudiantes): la bitácora es inmutable y no debe
 * retener datos de menores; el contenido vive en el diario, sus anotaciones y observaciones.
 */
export const FIELD_JOURNAL_AUDIT = {
  type: AuditLogType.FieldJournal,
  entity: 'diario_campo',
  snapshot: FieldJournalAuditSnapshot,
  redact: ['description', 'text', 'comment'],
};
