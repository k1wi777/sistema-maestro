import { Injectable } from '@nestjs/common';
import { AuditLogType } from '@gns/shared';
import type { AuditSnapshotSource } from '../../../core/audit/audit-snapshot';
import { ObserverNotesService } from './observer-notes.service';

/** Estado de la anotación para la bitácora: los campos de su fila, sin relaciones. */
@Injectable()
export class ObserverNoteAuditSnapshot implements AuditSnapshotSource {
  constructor(private readonly notes: ObserverNotesService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    return this.notes.findRaw(id);
  }
}

/**
 * Opciones de `@Audited` comunes a toda escritura del observador (también las de coordinación).
 * `redact` oculta el nombre del estudiante y los textos libres: la bitácora es inmutable y no
 * debe retener datos de menores; el contenido vive en la anotación y en el historial de revisión.
 */
export const OBSERVER_NOTE_AUDIT = {
  type: AuditLogType.ObserverNote,
  entity: 'observador_anotacion',
  snapshot: ObserverNoteAuditSnapshot,
  redact: ['studentFirstName', 'description', 'studentVersion', 'actions', 'followUp'],
};
