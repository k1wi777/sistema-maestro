import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError, ApiResult } from '@/shared/api';

export type RemoteState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: ApiError };

export interface Remote<T> {
  state: RemoteState<T>;
  /** Vuelve a pedir los datos (la pantalla muestra la carga mientras llega la respuesta). */
  reload: () => void;
}

/**
 * Pide datos a la API al montar y cada vez que cambia `key`. Una respuesta que llega tarde (la
 * clave ya cambió o el componente se desmontó) se descarta, de modo que nunca se pintan datos de
 * una consulta vieja. La carga se deriva de comparar la clave de la respuesta con la actual: no se
 * escribe estado de forma síncrona en el efecto.
 */
export function useRemote<T>(load: () => Promise<ApiResult<T>>, key: string): Remote<T> {
  const loadRef = useRef(load);
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<{ key: string; result: ApiResult<T> } | null>(null);
  const current = `${key}#${version}`;

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let cancelled = false;
    void loadRef.current().then((result) => {
      if (!cancelled) {
        setSettled({ key: `${key}#${version}`, result });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  if (settled === null || settled.key !== current) {
    return { state: { status: 'loading' }, reload };
  }
  return {
    state: settled.result.ok
      ? { status: 'ready', data: settled.result.data }
      : { status: 'error', error: settled.result.error },
    reload,
  };
}
