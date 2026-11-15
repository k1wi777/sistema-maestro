import {
  CertificateKind,
  TeacherModuleState,
  TrainingActivityType,
  type TeacherActivitySummary,
} from '@gns/shared';

import type { StatusTone } from '@/shared/ui';

/** Texto y tono de cada estado de un módulo en la ruta del docente. */
export const MODULE_STATE_INFO: Record<TeacherModuleState, { label: string; tone: StatusTone }> = {
  [TeacherModuleState.Pending]: { label: 'Pendiente', tone: 'info' },
  [TeacherModuleState.InProgress]: { label: 'En curso', tone: 'warning' },
  [TeacherModuleState.Done]: { label: 'Terminado', tone: 'success' },
};

/** Nombre de cada tipo de actividad del módulo. */
export const ACTIVITY_TYPE_LABEL: Record<TrainingActivityType, string> = {
  [TrainingActivityType.WheelPassport]: 'Ruleta y pasaporte',
  [TrainingActivityType.Match]: 'Conecta',
  [TrainingActivityType.TrueOrMyth]: 'Verdad o mito',
  [TrainingActivityType.Simulator]: 'Simulador',
};

export const CERTIFICATE_KIND_LABEL: Record<CertificateKind, string> = {
  [CertificateKind.Module]: 'Certificado de módulo',
  [CertificateKind.Route]: 'Certificado de la ruta completa',
};

/** Resultado de una actividad para pintar: sellos del pasaporte o mejor porcentaje; `null` sin avance. */
export function activityResult(activity: TeacherActivitySummary): string | null {
  if (activity.stamps) {
    return `${activity.stamps.done}/${activity.stamps.total} sellos`;
  }
  return activity.bestScore === null ? null : `${activity.bestScore}%`;
}

/** Título de un módulo con su número: «3 · Propuesta pedagógica». */
export function moduleTitleWithNumber(module: { number: string | null; title: string }): string {
  return module.number === null ? module.title : `${module.number} · ${module.title}`;
}
