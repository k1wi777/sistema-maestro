'use client';

import type { AuditLogEntry, AuditLogEntryDetail } from '@gns/shared';
import { useState } from 'react';

import type { ApiError } from '@/shared/api';
import {
  useCursorList,
  useRemote,
  type CursorList,
  type CursorPage,
  type Remote,
} from '@/shared/data';

import {
  exportAuditLog,
  getAuditEntry,
  listAssignedTeachers,
  listAuditLog,
} from '../api/audit-log';
import { auditFiltersKey, exportFileName, type AuditFilters } from '../model/audit-filters';
import type { NamedUser } from '../model/user-options';

const EMPTY_PAGE: CursorPage<AuditLogEntry> = { items: [], nextCursor: null };

/**
 * Movimientos con los filtros activos y «Cargar más». Con un rango de fechas inválido (`blocked`)
 * no se consulta la API: la lista queda vacía y la pantalla señala el campo.
 */
export function useAuditLog(filters: AuditFilters, blocked: boolean): CursorList<AuditLogEntry> {
  return useCursorList<AuditLogEntry>(
    (cursor) =>
      blocked ? Promise.resolve({ ok: true, data: EMPTY_PAGE }) : listAuditLog(filters, cursor),
    `${auditFiltersKey(filters)}:${blocked}`,
  );
}

/** Docentes con asignaciones del año vigente, para el selector de usuario. */
export function useAssignedTeachers(): Remote<NamedUser[]> {
  return useRemote(listAssignedTeachers, 'audit-teachers');
}

/** Detalle de un movimiento, con los datos de antes y después. */
export function useAuditEntry(id: string): Remote<AuditLogEntryDetail> {
  return useRemote(() => getAuditEntry(id), `audit-entry:${id}`);
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface AuditExport {
  busy: boolean;
  error: ApiError | null;
  start: () => Promise<void>;
}

/** Descarga el CSV con los filtros vigentes; un rechazo de la API se devuelve sin descargar nada. */
export function useAuditExport(filters: AuditFilters): AuditExport {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const result = await exportAuditLog(filters);
    if (result.ok) {
      saveBlob(result.data, exportFileName(new Date()));
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  return { busy, error, start };
}
