import { randomBytes, randomInt } from 'node:crypto';

/** Entero aleatorio en `[0, maxExclusive)`; se inyecta en los motores para probarlos. */
export type RandomInt = (maxExclusive: number) => number;

export const secureRandomInt: RandomInt = (maxExclusive) => randomInt(maxExclusive);

/** Mezcla de Fisher-Yates sobre una copia. */
export function shuffled<T>(items: readonly T[], random: RandomInt = secureRandomInt): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = random(index + 1);
    [copy[index], copy[other]] = [copy[other] as T, copy[index] as T];
  }
  return copy;
}

const sameOrder = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a.every((item, index) => item === b[index]);

/** Mezcla que nunca deja la lista como estaba (para ordenar pasos). */
export function shuffledDifferent<T>(
  items: readonly T[],
  random: RandomInt = secureRandomInt,
): T[] {
  if (items.length < 2) {
    return [...items];
  }
  let result = shuffled(items, random);
  for (let attempt = 0; attempt < 20 && sameOrder(result, items); attempt += 1) {
    result = shuffled(items, random);
  }
  // Un generador degenerado podría repetir el orden: se rota una posición como último recurso.
  return sameOrder(result, items) ? [...result.slice(1), result[0] as T] : result;
}

/** Token opaco que solo el estado de la partida relaciona con su elemento. */
export const newToken = (): string => randomBytes(9).toString('base64url');
