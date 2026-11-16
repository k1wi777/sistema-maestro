import {
  ChallengeQuestionType,
  TrackingModuleState,
  TrainingActivityStatus,
  TrainingActivityType,
  TrainingModuleStatus,
} from '@gns/shared';

import type { StatusTone } from '@/shared/ui';

/** Texto y tono de cada estado de un módulo dentro de su plan (nunca «eliminado» ni «anulado»). */
export const MODULE_STATUS_INFO: Record<TrainingModuleStatus, { label: string; tone: StatusTone }> =
  {
    [TrainingModuleStatus.Draft]: { label: 'Borrador', tone: 'warning' },
    [TrainingModuleStatus.Active]: { label: 'Publicado', tone: 'success' },
    [TrainingModuleStatus.OutOfPlan]: { label: 'Fuera del plan', tone: 'neutral' },
  };

export const ACTIVITY_STATUS_LABEL: Record<TrainingActivityStatus, string> = {
  [TrainingActivityStatus.Active]: 'En el módulo',
  [TrainingActivityStatus.OutOfPlan]: 'Fuera del módulo',
};

export const ACTIVITY_TYPE_LABEL: Record<TrainingActivityType, string> = {
  [TrainingActivityType.WheelPassport]: 'Ruleta y pasaporte',
  [TrainingActivityType.Match]: 'Conecta',
  [TrainingActivityType.TrueOrMyth]: 'Verdad o mito',
  [TrainingActivityType.Simulator]: 'Simulador',
};

export const QUESTION_TYPE_LABEL: Record<ChallengeQuestionType, string> = {
  [ChallengeQuestionType.MultipleChoice]: 'Opción múltiple',
  [ChallengeQuestionType.TrueFalse]: 'Verdadero o falso',
  [ChallengeQuestionType.Ordering]: 'Ordenar pasos',
};

/** Estado de un docente en un módulo del avance; «sin iniciar» se muestra como «Pendiente». */
export const TRACKING_STATE_INFO: Record<TrackingModuleState, { label: string; tone: StatusTone }> =
  {
    [TrackingModuleState.NotStarted]: { label: 'Pendiente', tone: 'info' },
    [TrackingModuleState.InProgress]: { label: 'En curso', tone: 'warning' },
    [TrackingModuleState.Done]: { label: 'Terminado', tone: 'success' },
  };

/** Título de un módulo con su número: «3 · Propuesta pedagógica». */
export function moduleTitleWithNumber(module: { number: string | null; title: string }): string {
  return module.number === null ? module.title : `${module.number} · ${module.title}`;
}
