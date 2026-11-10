import { GAME_LATENCY_MARGIN_SECONDS } from '@gns/shared';

/** Segundos entre dos instantes, con el reloj del servidor. */
export const secondsBetween = (from: Date, to: Date): number =>
  (to.getTime() - from.getTime()) / 1000;

/** Una respuesta pasado el tiempo (más el margen de latencia) cuenta como incorrecta. */
export const isLate = (elapsedSeconds: number, allowedSeconds: number): boolean =>
  elapsedSeconds > allowedSeconds + GAME_LATENCY_MARGIN_SECONDS;

const speedFraction = (elapsedSeconds: number, allowedSeconds: number): number =>
  Math.max(0, 1 - elapsedSeconds / allowedSeconds);

/** Bono por racha: crece 100 (o `step`) por acierto seguido a partir del segundo, hasta cuatro. */
const streakBonus = (streak: number, step: number): number =>
  streak > 1 ? step * Math.min(streak - 1, 4) : 0;

/** Puntos de un acierto del Desafío; `streak` es la racha incluida esta respuesta. */
export function challengePoints(elapsed: number, seconds: number, streak: number): number {
  return 500 + Math.round(500 * speedFraction(elapsed, seconds)) + streakBonus(streak, 100);
}

/** Puntos de una pareja conectada; la racha solo suma si fue al primer intento. */
export function matchPoints(
  firstAttempt: boolean,
  elapsed: number,
  seconds: number,
  streak: number,
): number {
  return (
    (firstAttempt ? 300 : 100) +
    Math.round(100 * speedFraction(elapsed, seconds)) +
    (firstAttempt ? streakBonus(streak, 50) : 0)
  );
}

/** Puntos de un acierto de verdad o mito. */
export function trueOrMythPoints(elapsed: number, seconds: number, streak: number): number {
  return 200 + Math.round(300 * speedFraction(elapsed, seconds)) + streakBonus(streak, 50);
}

/** Puntaje 0–100: solo depende de los aciertos, no de la rapidez ni de la racha. */
export function scorePercentage(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}
