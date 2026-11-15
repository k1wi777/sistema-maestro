import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * `false` en el servidor y durante la hidratación, `true` ya en el navegador con React activo.
 * Mantiene deshabilitado «Ingresar» hasta que el formulario puede enviarse con `onSubmit`
 * (un envío antes de hidratar sería un envío HTML nativo, sin el manejo de errores).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
