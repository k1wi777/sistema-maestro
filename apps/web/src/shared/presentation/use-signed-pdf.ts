'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError, ApiResult } from '@/shared/api';

import { classifyPdfError, loadPercent, type PdfFailure } from './pdf-deck-model';
import { openPdf, type PdfHandle } from './pdf-loader';

/** Pide una URL firmada de lectura; cada feature pasa la suya (así `shared` no conoce sus rutas). */
export type FetchSignedUrl = () => Promise<ApiResult<{ url: string }>>;

/** Por qué no hay documento: la API no entregó la URL, o pdf.js no pudo abrir el archivo. */
export type PdfOpenFailure =
  { source: 'api'; error: ApiError } | { source: 'pdf'; failure: PdfFailure };

export type SignedPdfState =
  | { status: 'loading'; percent: number | null }
  | { status: 'ready'; document: PDFDocumentProxy }
  | { status: 'error'; failure: PdfOpenFailure };

type Opened =
  | { ok: true; handle: PdfHandle; document: PDFDocumentProxy }
  | { ok: false; failure: PdfOpenFailure };

async function openFromApi(
  fetchUrl: FetchSignedUrl,
  onProgress?: (percent: number | null) => void,
): Promise<Opened> {
  const signed = await fetchUrl();
  if (!signed.ok) {
    return { ok: false, failure: { source: 'api', error: signed.error } };
  }
  const handle = openPdf(signed.data.url, (loaded, total) =>
    onProgress?.(loadPercent(loaded, total)),
  );
  try {
    return { ok: true, handle, document: await handle.promise };
  } catch (error) {
    void handle.destroy();
    return { ok: false, failure: { source: 'pdf', failure: classifyPdfError(error) } };
  }
}

/**
 * Abre el PDF de una URL firmada y lo cierra al desmontar o al cambiar `sourceKey`. La URL se
 * pide al abrir (caduca): si vence mientras el docente navega, `renew` pide otra y reabre el
 * documento sin pasar por la carga. `reload` repite la apertura desde el principio.
 */
export function useSignedPdf(fetchUrl: FetchSignedUrl, sourceKey: string) {
  const fetchRef = useRef(fetchUrl);
  const handleRef = useRef<PdfHandle | null>(null);
  const keyRef = useRef('');
  const aliveRef = useRef(true);
  const [version, setVersion] = useState(0);
  const [progress, setProgress] = useState<{ key: string; percent: number | null } | null>(null);
  const [settled, setSettled] = useState<{
    key: string;
    state: Exclude<SignedPdfState, { status: 'loading' }>;
  } | null>(null);
  const current = `${sourceKey}#${version}`;

  useEffect(() => {
    fetchRef.current = fetchUrl;
    keyRef.current = current;
  });

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    const key = `${sourceKey}#${version}`;
    let cancelled = false;
    void (async () => {
      const opened = await openFromApi(fetchRef.current, (percent) => {
        if (!cancelled) {
          setProgress({ key, percent });
        }
      });
      if (cancelled) {
        if (opened.ok) {
          void opened.handle.destroy();
        }
        return;
      }
      if (opened.ok) {
        handleRef.current = opened.handle;
        setSettled({ key, state: { status: 'ready', document: opened.document } });
      } else {
        setSettled({ key, state: { status: 'error', failure: opened.failure } });
      }
    })();
    return () => {
      cancelled = true;
      void handleRef.current?.destroy();
      handleRef.current = null;
    };
    // `sourceKey` reabre al cambiar de archivo, como `useRemote` con su clave.
  }, [sourceKey, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  const renew = useCallback(async (): Promise<PDFDocumentProxy | null> => {
    const requested = keyRef.current;
    const opened = await openFromApi(fetchRef.current);
    if (!aliveRef.current || keyRef.current !== requested) {
      if (opened.ok) {
        void opened.handle.destroy();
      }
      return null;
    }
    if (!opened.ok) {
      setSettled({ key: requested, state: { status: 'error', failure: opened.failure } });
      return null;
    }
    const previous = handleRef.current;
    handleRef.current = opened.handle;
    void previous?.destroy();
    setSettled({ key: requested, state: { status: 'ready', document: opened.document } });
    return opened.document;
  }, []);

  const state: SignedPdfState =
    settled !== null && settled.key === current
      ? settled.state
      : {
          status: 'loading',
          percent: progress !== null && progress.key === current ? progress.percent : null,
        };

  return { state, reload, renew };
}
