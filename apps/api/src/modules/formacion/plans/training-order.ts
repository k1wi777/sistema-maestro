import { ConflictException } from '@nestjs/common';

/**
 * El nuevo orden solo se acepta si es la lista completa y sin repetidos de los elementos
 * actuales (R7); de lo contrario, 409 y nada cambia. Se llama con el padre bloqueado, así que
 * un alta concurrente hace fallar el orden que no la incluye.
 */
export function assertCompleteOrder(
  requested: readonly string[],
  current: readonly string[],
): void {
  const requestedSet = new Set(requested);
  const matches =
    requestedSet.size === requested.length &&
    requested.length === current.length &&
    current.every((id) => requestedSet.has(id));
  if (!matches) {
    throw new ConflictException(
      'La lista no coincide con los elementos actuales: envía todos, sin repetir ninguno',
    );
  }
}
