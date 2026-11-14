/**
 * Avisos del cliente HTTP al proveedor de sesión. El cliente es un módulo único, así que el
 * proveedor se suscribe aquí en lugar de recibirlos por props.
 */
export type SessionEvent = 'ended' | 'consent-required';

type Listener = () => void;

const listeners: Record<SessionEvent, Set<Listener>> = {
  ended: new Set(),
  'consent-required': new Set(),
};

/** Suscribe `listener` al evento y devuelve la función de baja. */
export function onSessionEvent(event: SessionEvent, listener: Listener): () => void {
  listeners[event].add(listener);
  return () => {
    listeners[event].delete(listener);
  };
}

export function emitSessionEvent(event: SessionEvent): void {
  for (const listener of [...listeners[event]]) {
    listener();
  }
}
