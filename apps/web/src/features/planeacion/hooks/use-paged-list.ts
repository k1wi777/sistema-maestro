import type { Page } from '@gns/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError, ApiResult } from '@/shared/api';

interface PagedSnapshot<T> {
  key: string;
  items: T[];
  page: number;
  totalItems: number;
  totalPages: number;
  error: ApiError | null;
  loadingMore: boolean;
}

export interface PagedList<T> {
  status: 'loading' | 'ready' | 'error';
  items: T[];
  totalItems: number;
  hasMore: boolean;
  loadingMore: boolean;
  /** Error de la carga inicial (`status` `error`) o de «Cargar más». */
  error: ApiError | null;
  loadMore: () => void;
  /** Cambia los elementos ya cargados (p. ej. una favorita) sin volver a pedirlos. */
  mutate: (update: (items: T[]) => T[]) => void;
  reload: () => void;
}

/**
 * Lista paginada con «Cargar más»: la primera página se pide al montar y cada vez que cambia
 * `key` (los filtros); las siguientes se agregan al final. Las respuestas viejas se descartan.
 */
export function usePagedList<T>(
  fetchPage: (page: number) => Promise<ApiResult<Page<T>>>,
  key: string,
): PagedList<T> {
  const fetchRef = useRef(fetchPage);
  const keyRef = useRef(key);
  const snapshotRef = useRef<PagedSnapshot<T> | null>(null);
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<PagedSnapshot<T> | null>(null);
  const current = `${key}#${version}`;

  useEffect(() => {
    fetchRef.current = fetchPage;
    keyRef.current = current;
    snapshotRef.current = snapshot;
  });

  useEffect(() => {
    let cancelled = false;
    void fetchRef.current(1).then((result) => {
      if (cancelled) {
        return;
      }
      const settledKey = `${key}#${version}`;
      setSnapshot(
        result.ok
          ? {
              key: settledKey,
              items: result.data.items,
              page: result.data.page,
              totalItems: result.data.totalItems,
              totalPages: result.data.totalPages,
              error: null,
              loadingMore: false,
            }
          : {
              key: settledKey,
              items: [],
              page: 0,
              totalItems: 0,
              totalPages: 0,
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
    if (!previous || previous.key !== requestedKey || previous.loadingMore) {
      return;
    }
    const loading = { ...previous, loadingMore: true, error: null };
    snapshotRef.current = loading;
    setSnapshot(loading);
    void fetchRef.current(previous.page + 1).then((result) => {
      setSnapshot((latest) => {
        if (!latest || latest.key !== requestedKey) {
          return latest;
        }
        return result.ok
          ? {
              ...latest,
              items: [...latest.items, ...result.data.items],
              page: result.data.page,
              totalItems: result.data.totalItems,
              totalPages: result.data.totalPages,
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
      totalItems: 0,
      hasMore: false,
      loadingMore: false,
      error: null,
      loadMore,
      mutate,
      reload,
    };
  }
  const failed = snapshot.page === 0 && snapshot.error !== null;
  return {
    status: failed ? 'error' : 'ready',
    items: snapshot.items,
    totalItems: snapshot.totalItems,
    hasMore: snapshot.page < snapshot.totalPages,
    loadingMore: snapshot.loadingMore,
    error: snapshot.error,
    loadMore,
    mutate,
    reload,
  };
}
