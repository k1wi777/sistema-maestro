'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Parámetros de la URL de la pantalla actual. `update` cambia solo los indicados (un valor vacío
 * quita el parámetro) y reemplaza la entrada del historial sin desplazar la página, de modo que los
 * filtros se pueden compartir y el botón Atrás no queda atrapado en cada cambio.
 */
export function useQueryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return { params, update };
}
