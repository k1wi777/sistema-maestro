import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError, ApiResult } from '@/shared/api';

/** Una página de una lista por cursor: `nextCursor` es `null` en la última. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

interface CursorSnapshot<T> {
  key: string;
  items: T[];
  nextCursor: string | null;
  loaded: boolean;
  error: ApiError | null;
  loadingMore: boolean;
}

export interface CursorList<T> {
  status: 'loading' | 'ready' | 'error';
  items: T[];
  hasMore: boolean;
  loadingMore: boolean;
  /** Error de la carga inicial (`status` `error`) o de «Cargar más». */
  error: ApiError | null;
  loadMore: () => void;
  mutate: (update: (items: T[]) => T[]) => void;
  reload: () => void;
}

/**
 * Lista con «Cargar más» por cursor (sin total): la primera página se pide al montar y cada vez
 * que cambia `key` (los filtros); las siguientes se agregan al final con el cursor que devolvió la
 * anterior. Las respuestas viejas se descartan igual que en `usePagedList`.
 */
export function useCursorList<T>(
  fetchPage: (cursor: string | null) => Promise<ApiResult<CursorPage<T>>>,
  key: string,
): CursorList<T> {
  const fetchRef = useRef(fetchPage);
  const keyRef = useRef(key);
  const snapshotRef = useRef<CursorSnapshot<T> | null>(null);
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<CursorSnapshot<T> | null>(null);
  const current = `${key}#${version}`;

  useEffect(() => {
    fetchRef.current = fetchPage;
    keyRef.current = current;
    snapshotRef.current = snapshot;
  });

  useEffect(() => {
    let cancelled = false;
    void fetchRef.current(null).then((result) => {
      if (cancelled) {
        return;
      }
      const settledKey = `${key}#${version}`;
      setSnapshot(
        result.ok
          ? {
              key: settledKey,
              items: result.data.items,
              nextCursor: result.data.nextCursor,
              loaded: true,
              error: null,
              loadingMore: false,
            }
          : {
              key: settledKey,
              items: [],
              nextCursor: null,
              loaded: false,
              error: result.error,
              loadingMore: false,
            },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const loadMore = useCallback(() => {
    const previous = snapshotRef.current;
    const requestedKey = keyRef.current;
    if (
      !previous ||
      previous.key !== requestedKey ||
      previous.loadingMore ||
      previous.nextCursor === null
    ) {
      return;
    }
    const loading = { ...previous, loadingMore: true, error: null };
    snapshotRef.current = loading;
    setSnapshot(loading);
    void fetchRef.current(previous.nextCursor).then((result) => {
      setSnapshot((latest) => {
        if (!latest || latest.key !== requestedKey) {
          return latest;
        }
        return result.ok
          ? {
              ...latest,
              items: [...latest.items, ...result.data.items],
              nextCursor: result.data.nextCursor,
              error: null,
              loadingMore: false,
            }
          : { ...latest, error: result.error, loadingMore: false };
      });
    });
  }, []);

  const mutate = useCallback((update: (items: T[]) => T[]) => {
    setSnapshot((previous) =>
      previous ? { ...previous, items: update(previous.items) } : previous,
    );
  }, []);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  if (snapshot === null || snapshot.key !== current) {
    return {
      status: 'loading',
      items: [],
      hasMore: false,
      loadingMore: false,
      error: null,
      loadMore,
      mutate,
      reload,
    };
  }
  return {
    status: snapshot.loaded ? 'ready' : 'error',
    items: snapshot.items,
    hasMore: snapshot.nextCursor !== null,
    loadingMore: snapshot.loadingMore,
    error: snapshot.error,
    loadMore,
    mutate,
    reload,
  };
}
