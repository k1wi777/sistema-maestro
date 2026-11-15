import { TrainingActivityType, type TeacherActivity } from '@gns/shared';

/** Avance de una actividad para pintar: sellos, mejor resultado o si ya se usó el simulador. */
export function progressText(activity: TeacherActivity): string {
  const { progress } = activity;
  if (activity.type === TrainingActivityType.WheelPassport) {
    return progress.completedAt
      ? 'Pasaporte completo'
      : `${progress.stamps.length} de ${activity.config.tarjetas.length} sellos conseguidos`;
  }
  if (progress.completedAt) {
    return progress.bestScore === null
      ? 'Terminada'
      : `Terminada · mejor resultado ${progress.bestScore}%`;
  }
  return progress.bestScore === null ? 'Sin empezar' : `Mejor resultado ${progress.bestScore}%`;
}
