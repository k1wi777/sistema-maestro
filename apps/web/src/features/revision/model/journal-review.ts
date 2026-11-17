import {
  JournalStatus,
  returnJournalSchema,
  type FieldJournalSummary,
  type ReturnJournalInput,
} from '@gns/shared';

import { sentence } from './messages';

/** Un diario pendiente de revisión (enviado) en la cola de la persona de coordinación. */
export type QueueItem = Pick<FieldJournalSummary, 'id' | 'status'>;

/** Diarios enviados en el orden de la bandeja: la cola que recorre «Aprobar y pasar al siguiente». */
export function pendingQueue(items: readonly QueueItem[]): string[] {
  return items.filter((item) => item.status === JournalStatus.Submitted).map((item) => item.id);
}

/** Posición del diario en la cola («1 de 3 pendientes»); `null` si no está en ella. */
export function queuePosition(
  queue: readonly string[],
  id: string,
): { index: number; total: number } | null {
  const index = queue.indexOf(id);
  return index === -1 ? null : { index: index + 1, total: queue.length };
}

/** El siguiente diario pendiente distinto del actual (primero hacia delante y luego desde el inicio). */
export function nextPending(queue: readonly string[], id: string): string | null {
  const index = queue.indexOf(id);
  const after = index === -1 ? queue : queue.slice(index + 1);
  const before = index === -1 ? [] : queue.slice(0, index);
  return [...after, ...before].find((candidate) => candidate !== id) ?? null;
}

/** «1 observación» / «3 observaciones» (sobre anotaciones). */
export function observationCountLabel(count: number): string {
  return count === 1 ? '1 observación' : `${count} observaciones`;
}

export type ReturnBuild = { ok: true; data: ReturnJournalInput } | { ok: false; message: string };

/**
 * Cuerpo de «Devolver con observaciones»: las observaciones por anotación (solo las que tienen
 * texto) y la observación general. Valida con el esquema de la API (al menos una de las dos).
 */
export function buildReturnBody(
  general: string,
  observations: Readonly<Record<string, string>>,
): ReturnBuild {
  const parsed = returnJournalSchema.safeParse({
    comment: general,
    observations: Object.entries(observations)
      .filter(([, text]) => text.trim() !== '')
      .map(([annotationId, text]) => ({ annotationId, text })),
  });
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  return {
    ok: false,
    message:
      general.trim() === '' && Object.values(observations).every((text) => text.trim() === '')
        ? 'Escribe una observación general o sobre alguna anotación para devolver el diario.'
        : sentence(parsed.error.issues[0]?.message ?? 'Las observaciones no son válidas.'),
  };
}
