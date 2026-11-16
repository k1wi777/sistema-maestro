import { RecordStatus, type LessonPlan, type LessonPlanAdjustableField } from '@gns/shared';

import type { BlockKey } from './plan-blocks';

/** Versión del formato guardado: si cambia, los borradores viejos se descartan. */
export const DRAFT_VERSION = 1;

/**
 * Borrador de «Guardar ajustes sin decidir». La API no tiene ajustes sin decisión: se guarda en
 * este navegador, por usuario y planeación. Las planeaciones no contienen datos de estudiantes.
 */
export interface ReviewDraft {
  version: typeof DRAFT_VERSION;
  /** `updatedAt` de la planeación al guardar (ISO): si cambió, el borrador ya no aplica. */
  planUpdatedAt: string;
  /** Valor del formulario de cada campo ajustado. */
  adjustments: Partial<Record<LessonPlanAdjustableField, string>>;
  observations: Partial<Record<BlockKey, string>>;
  general: string;
  savedAt: string;
}

export function draftKey(userId: string, planId: string): string {
  return `gns-revision:${userId}:${planId}`;
}

export function serializeDraft(draft: ReviewDraft): string {
  return JSON.stringify(draft);
}

export type DraftRestore =
  | { kind: 'none' }
  | { kind: 'restored'; draft: ReviewDraft }
  | { kind: 'discarded'; reason: 'changed' | 'status' | 'corrupt' };

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === 'string');

function parseDraft(raw: string): ReviewDraft | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const draft = value as Partial<Record<keyof ReviewDraft, unknown>>;
  if (
    draft.version !== DRAFT_VERSION ||
    typeof draft.planUpdatedAt !== 'string' ||
    typeof draft.general !== 'string' ||
    typeof draft.savedAt !== 'string' ||
    !isStringRecord(draft.adjustments) ||
    !isStringRecord(draft.observations)
  ) {
    return null;
  }
  return draft as unknown as ReviewDraft;
}

/**
 * Decide qué hacer con lo guardado: se restaura solo si la planeación sigue enviada y no cambió
 * desde que se guardó; si no, se descarta (y la pantalla avisa y lo borra).
 */
export function restoreDraft(
  raw: string | null,
  plan: Pick<LessonPlan, 'status' | 'updatedAt'>,
): DraftRestore {
  if (raw === null) {
    return { kind: 'none' };
  }
  const draft = parseDraft(raw);
  if (!draft) {
    return { kind: 'discarded', reason: 'corrupt' };
  }
  if (plan.status !== RecordStatus.Submitted) {
    return { kind: 'discarded', reason: 'status' };
  }
  if (draft.planUpdatedAt !== plan.updatedAt.toISOString()) {
    return { kind: 'discarded', reason: 'changed' };
  }
  return { kind: 'restored', draft };
}

/** Un borrador sin ajustes, observaciones ni general no vale la pena guardarlo. */
export function isEmptyDraft(
  draft: Pick<ReviewDraft, 'adjustments' | 'observations' | 'general'>,
): boolean {
  return (
    Object.keys(draft.adjustments).length === 0 &&
    Object.values(draft.observations).every((text) => !text?.trim()) &&
    !draft.general.trim()
  );
}
