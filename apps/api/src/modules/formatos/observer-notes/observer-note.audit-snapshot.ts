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
 * Bitácora del descarte de un borrador: solo estado, grado y tipo. La fila desaparece, así que el
 * detalle sale del estado anterior; nunca incluye el nombre del estudiante ni textos libres.
 */
@Injectable()
export class ObserverNoteDiscardSnapshot implements AuditSnapshotSource {
  constructor(private readonly notes: ObserverNotesService) {}

  async load(id: string): Promise<Record<string, unknown> | null> {
    return this.notes.findDiscardSnapshot(id);
  }

  /** El grado de la anotación descartada. */
  describe(snapshot: Record<string, unknown>): string | null {
    const { grade } = snapshot as { grade?: string };
    return grade ?? null;
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
  redact: [
    'studentFirstName',
    'description',
    'studentVersion',
    'pedagogicalStrategies',
    'actions',
    'followUp',
  ],
};
