import type { CompletionSnapshot } from './training-progress.repository';

/**
 * Regla de terminación de un módulo (BE-1, Decisión 3): el video (si hay), la presentación (si
 * hay diapositivas o enlace), el Desafío aprobado (si hay preguntas) y todas las actividades
 * obligatorias activas. `aprobado_en` ya incorpora el `umbral_aprobacion` del módulo.
 */
export function isModuleComplete(facts: CompletionSnapshot): boolean {
  const needsVideo = facts.videoUrl !== null;
  const needsPresentation = facts.slideCount > 0 || facts.presentationUrl !== null;
  const needsChallenge = facts.questionCount > 0;
  return (
    (!needsVideo || facts.videoViewedAt !== null) &&
    (!needsPresentation || facts.presentationViewedAt !== null) &&
    (!needsChallenge || facts.passedAt !== null) &&
    facts.requiredActivities.every((activity) => activity.completedAt !== null)
  );
}
