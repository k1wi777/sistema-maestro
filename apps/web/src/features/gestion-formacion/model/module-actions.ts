import { TrainingModuleStatus } from '@gns/shared';

export type ModuleActionId = 'edit' | 'publish' | 'tracking' | 'withdraw' | 'restore';

export const MODULE_ACTION_LABEL: Record<ModuleActionId, string> = {
  edit: 'Editar',
  publish: 'Publicar',
  tracking: 'Seguimiento',
  withdraw: 'Quitar del plan',
  restore: 'Restaurar',
};

/**
 * Solo las acciones que tienen sentido en cada estado: borrador → editar y publicar; publicado →
 * editar, seguimiento y quitar del plan; fuera del plan → editar y restaurar. Nunca «eliminar».
 */
export function moduleActions(status: TrainingModuleStatus): ModuleActionId[] {
  switch (status) {
    case TrainingModuleStatus.Draft:
      return ['edit', 'publish'];
    case TrainingModuleStatus.Active:
      return ['edit', 'tracking', 'withdraw'];
    case TrainingModuleStatus.OutOfPlan:
      return ['edit', 'restore'];
  }
}

export interface Confirmation {
  title: string;
  description: string;
  confirmLabel: string;
}

/** Lo que se explica antes de quitar un módulo del plan: se puede restaurar y nada se pierde. */
export function withdrawConfirmation(title: string): Confirmation {
  return {
    title: `¿Quitar «${title}» del plan?`,
    description:
      'El módulo deja de verse en la ruta de los docentes. El progreso que ya tienen se conserva y puedes restaurarlo cuando quieras.',
    confirmLabel: 'Quitar del plan',
  };
}
