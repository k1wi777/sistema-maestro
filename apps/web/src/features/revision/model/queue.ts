import { RecordStatus, type LessonPlan } from '@gns/shared';

/**
 * Siguiente planeación por revisar: la primera enviada de la lista (pedida de la más antigua a la
 * más reciente) que no es la actual ni de quien revisa (la API rechaza la autorrevisión).
 */
export function nextPendingPlan(
  oldestFirst: readonly LessonPlan[],
  currentId: string,
  reviewerId: string,
): LessonPlan | null {
  return (
    oldestFirst.find(
      (plan) =>
        plan.status === RecordStatus.Submitted &&
        plan.id !== currentId &&
        plan.teacher.id !== reviewerId,
    ) ?? null
  );
}
