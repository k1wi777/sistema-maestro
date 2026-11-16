import {
  ReviewAction,
  type LessonPlan,
  type LessonPlanAdjustableField,
  type Review,
} from '@gns/shared';

import { FIELD_BY_COLUMN } from '@/shared/records/lesson-plan-fields';

import { blockOfField, type BlockKey, type PlanBlock } from './plan-blocks';
import { parseReviewComment, type BlockObservations } from './review-comment';

export interface Resubmission {
  /** Fecha de la última devolución. */
  returnedAt: Date;
  /** Fecha del último envío del docente (posterior a la devolución). */
  resubmittedAt: Date;
  reviewer: string;
  /** Observación que cada bloque recibió en esa devolución. */
  observations: BlockObservations;
  /** Parte del comentario que no era de un bloque. */
  general: string;
  /** Bloques ajustados en esa devolución cuyo valor actual difiere del ajustado. */
  changedBlocks: BlockKey[];
}

/** Igual que `diffFields`: vacío y `undefined` son `null`. */
const normalize = (value: unknown): unknown => (value === undefined || value === '' ? null : value);

/**
 * Reenvío de una planeación devuelta: aplica solo si está enviada y su último envío es posterior a
 * la última decisión de coordinación, que fue una devolución. La API no guarda una instantánea del
 * contenido al devolver, así que lo único comparable son los campos que coordinación ajustó en esa
 * devolución (`changes.after`); las filas sin valores guardados (datos demo) no marcan nada.
 */
export function findResubmission(
  plan: Pick<LessonPlan, LessonPlanAdjustableField | 'status' | 'submittedAt'>,
  reviews: readonly Review[],
  blocks: readonly PlanBlock[],
): Resubmission | null {
  if (plan.status !== 'enviada' || !plan.submittedAt) {
    return null;
  }
  let last: Review | null = null;
  for (const review of reviews) {
    if (
      review.action !== ReviewAction.Adjustment &&
      (!last || review.date.getTime() >= last.date.getTime())
    ) {
      last = review;
    }
  }
  if (
    !last ||
    last.action !== ReviewAction.ChangesRequested ||
    last.date.getTime() >= plan.submittedAt.getTime()
  ) {
    return null;
  }
  const time = last.date.getTime();
  const changed = new Set<BlockKey>();
  for (const review of reviews) {
    if (review.date.getTime() !== time) {
      continue;
    }
    for (const change of review.changes) {
      const key = FIELD_BY_COLUMN[change.field];
      if (key && normalize(plan[key]) !== normalize(change.after)) {
        changed.add(blockOfField(key));
      }
    }
  }
  const parsed = parseReviewComment(last.comment, blocks);
  return {
    returnedAt: last.date,
    resubmittedAt: plan.submittedAt,
    reviewer: last.reviewer.fullName,
    observations: parsed.blocks,
    general: parsed.general,
    changedBlocks: [...changed],
  };
}
