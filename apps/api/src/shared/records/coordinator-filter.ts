import { NO_COORDINATOR_FILTER } from '@gns/shared';

/**
 * Traduce el filtro `coordinatorId` de las bandejas (un UUID o `none`) a la condición sobre el
 * grado del registro: `coordinatorId = X` o `IS NULL`. Sin filtro no condiciona nada.
 */
export function gradeCoordinatorWhere(
  coordinatorId: string | undefined,
): { coordinatorId: string | null } | undefined {
  if (coordinatorId === undefined) {
    return undefined;
  }
  return { coordinatorId: coordinatorId === NO_COORDINATOR_FILTER ? null : coordinatorId };
}
