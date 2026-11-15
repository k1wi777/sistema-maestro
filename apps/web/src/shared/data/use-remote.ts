import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError, ApiResult } from '@/shared/api';

export type RemoteState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: ApiError };

export interface Remote<T> {
  state: RemoteState<T>;
  /** Vuelve a pedir los datos (la pantalla muestra la carga mientras llega la respuesta). */
  reload: () => void;
  /**
   * Vuelve a pedir los datos sin pasar por la carga: la pantalla sigue mostrando lo que tenía y
   * solo cambia cuando llega la respuesta. Si falla, conserva los datos y devuelve el error.
   */
  refresh: () => Promise<ApiError | null>;
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
  const currentRef = useRef(current);

  useEffect(() => {
    loadRef.current = load;
    currentRef.current = current;
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

  const refresh = useCallback(async (): Promise<ApiError | null> => {
    const requested = currentRef.current;
    const result = await loadRef.current();
    if (!result.ok) {
      return result.error;
    }
    // Una respuesta de una consulta que ya cambió de clave o de versión se descarta.
    if (currentRef.current === requested) {
      setSettled({ key: requested, result });
    }
    return null;
  }, []);

  if (settled === null || settled.key !== current) {
    return { state: { status: 'loading' }, reload, refresh };
  }
  return {
    state: settled.result.ok
      ? { status: 'ready', data: settled.result.data }
      : { status: 'error', error: settled.result.error },
    reload,
    refresh,
  };
}
