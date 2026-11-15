import type { TeacherActivity } from '@gns/shared';

import type { BestAttempt } from './challenge';

/** Mejor intento de una actividad con puntaje; `null` mientras no haya terminado ninguna partida. */
export function bestOf(progress: TeacherActivity['progress']): BestAttempt | null {
  return progress.bestScore === null
    ? null
    : { score: progress.bestScore, points: progress.bestPoints ?? 0 };
}
