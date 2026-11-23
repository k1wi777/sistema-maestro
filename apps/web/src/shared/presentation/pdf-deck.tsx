'use client';

import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button, Notice } from '@/shared/ui';

import { DeckFrame } from './deck-frame';
import styles from './deck.module.css';
import { classifyPdfError, isCancellation, planRender, type PdfFailure } from './pdf-deck-model';
import { useSignedPdf, type FetchSignedUrl, type PdfOpenFailure } from './use-signed-pdf';

/** Retardo antes de volver a dibujar tras un cambio de tamaño (girar el celular, pantalla completa). */
const RESIZE_DELAY_MS = 150;
/** Alto máximo de la página fuera de pantalla completa, como fracción de la ventana. */
const MAX_HEIGHT_RATIO = 0.7;

interface StageBox {
  width: number;
  height: number;
  padY: number;
}

/**
 * Escenario de la página: dibuja solo la página pedida en un canvas fuera de pantalla y luego lo
 * pasa al visible (sin parpadear en blanco), cancela el dibujo anterior al cambiar de página y
 * prepara en segundo plano los datos de la siguiente.
 */
function PdfStage({
  pdfDocument,
  pageNumber,
  name,
  fullscreen,
  onDrawn,
  onFailure,
}: {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  name: string;
  fullscreen: boolean;
  onDrawn: (pageNumber: number) => void;
  onFailure: (error: unknown) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState<StageBox | null>(null);
  const [drawn, setDrawn] = useState(false);
  const callbacks = useRef({ onDrawn, onFailure });

  useEffect(() => {
    callbacks.current = { onDrawn, onFailure };
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    const measure = () => {
      const style = getComputedStyle(stage);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      setBox({ width: stage.clientWidth - padX, height: stage.clientHeight, padY });
    };
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      if (first) {
        first = false;
        measure();
      } else {
        timer = setTimeout(measure, RESIZE_DELAY_MS);
      }
    });
    observer.observe(stage);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  // Solo la altura de pantalla completa fuerza a dibujar de nuevo: fuera de ella la altura sale de
  // la propia página y no debe provocar un ciclo.
  const limitHeight = fullscreen && box ? box.height : 0;

  useEffect(() => {
    if (!box || box.width <= 0) {
      return;
    }
    let cancelled = false;
    let task: RenderTask | null = null;
    let page: PDFPageProxy | null = null;
    void (async () => {
      try {
        page = await pdfDocument.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const available = fullscreen ? box.height : window.innerHeight * MAX_HEIGHT_RATIO;
        const plan = planRender({
          pageWidth: base.width,
          pageHeight: base.height,
          containerWidth: box.width,
          maxHeight: Math.max(available - box.padY, 120),
          devicePixelRatio: window.devicePixelRatio || 1,
        });
        const viewport = page.getViewport({ scale: plan.scale });
        const buffer = window.document.createElement('canvas');
        buffer.width = Math.ceil(viewport.width);
        buffer.height = Math.ceil(viewport.height);
        task = page.render({ canvas: buffer, viewport });
        await task.promise;
        const canvas = canvasRef.current;
        if (cancelled || !canvas) {
          return;
        }
        canvas.width = buffer.width;
        canvas.height = buffer.height;
        canvas.style.width = `${plan.cssWidth}px`;
        canvas.style.height = `${plan.cssHeight}px`;
        canvas.getContext('2d')?.drawImage(buffer, 0, 0);
        setDrawn(true);
        callbacks.current.onDrawn(pageNumber);
        if (pageNumber < pdfDocument.numPages) {
          void pdfDocument.getPage(pageNumber + 1).catch(() => undefined);
        }
      } catch (error) {
        if (!cancelled && !isCancellation(error)) {
          callbacks.current.onFailure(error);
        }
      } finally {
        page?.cleanup();
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
    // El ancho, y la altura solo en pantalla completa, definen el tamaño del dibujo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDocument, pageNumber, box?.width, box?.padY, fullscreen, limitHeight]);

  return (
    <div ref={stageRef} className={styles.pdfStage}>
      {drawn ? null : <p className={styles.pdfPlaceholder}>Dibujando la página…</p>}
      <canvas
        ref={canvasRef}
        className={styles.pdfCanvas}
        hidden={!drawn}
        role="img"
        aria-label={`Página ${pageNumber} de ${pdfDocument.numPages} de ${name}`}
      />
    </div>
  );
}

/** Estado de carga con porcentaje cuando se conoce el tamaño. */
function PdfLoading({ percent }: { percent: number | null }) {
  return (
    <div className={styles.state} role="status">
      <b>Preparando la presentación…</b>
      {percent !== null ? (
        <>
          <div
            className={styles.bar}
            role="progressbar"
            aria-label="Descarga de la presentación"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span className={styles.barFill} style={{ width: `${percent}%` }} />
          </div>
          <p>{`${percent} %`}</p>
        </>
      ) : null}
    </div>
  );
}

/** Guarda el PDF con su nombre original: con el documento abierto no depende de la URL firmada. */
function DownloadButton({
  name,
  pdfDocument,
  fetchUrl,
}: {
  name: string;
  pdfDocument: PDFDocumentProxy | null;
  fetchUrl: FetchSignedUrl;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      if (!pdfDocument) {
        throw new Error('Sin documento abierto');
      }
      const data = await pdfDocument.getData();
      const url = URL.createObjectURL(
        new Blob([data as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      );
      const link = window.document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // Sin documento abierto (o con la URL vencida) se pide una nueva y el navegador abre o guarda el PDF.
      const signed = await fetchUrl();
      if (signed.ok) {
        window.location.assign(signed.data.url);
      } else {
        setFailed(true);
      }
    }
    setBusy(false);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        startIcon="bajar"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? 'Preparando…' : 'Descargar PDF'}
      </Button>
      {failed ? (
        <Notice tone="error" title="No pudimos descargar el PDF">
          <p>Revisa tu conexión e inténtalo de nuevo.</p>
        </Notice>
      ) : null}
    </>
  );
}

function PdfFailureView({
  failure,
  name,
  fetchUrl,
  busy,
  onRetry,
  children,
}: {
  failure: PdfOpenFailure;
  name: string;
  fetchUrl: FetchSignedUrl;
  busy?: boolean;
  onRetry: () => void;
  children?: ReactNode;
}) {
  const message = failure.source === 'api' ? failure.error.message : failure.failure.message;
  return (
    <Notice tone="error" title="No pudimos mostrar la presentación">
      <p>{message}</p>
      <div className={styles.stateActions}>
        <Button variant="outline" size="sm" disabled={busy} onClick={onRetry}>
          Reintentar
        </Button>
        <DownloadButton name={name} pdfDocument={null} fetchUrl={fetchUrl} />
      </div>
      {children}
    </Notice>
  );
}

/**
 * PDF como diapositivas dentro del visor común: una página a la vez, «Anterior» y «Siguiente»,
 * «Página n de m», flechas del teclado, pantalla completa y «Descargar PDF». La URL firmada se
 * pide al abrir y, si vence mientras se navega, se renueva una vez sin que el usuario lo note.
 */
export function PdfDeck({
  name,
  fetchUrl,
  sourceKey,
  onLastPage,
  errorExtra,
}: {
  /** Nombre original del archivo: nombra el visor y el archivo descargado. */
  name: string;
  /** Pide la URL firmada de lectura del PDF. */
  fetchUrl: FetchSignedUrl;
  /** Cambia cuando cambia el archivo, para abrirlo de nuevo. */
  sourceKey: string;
  /** Se llama una vez por visita cuando la última página ya está dibujada. */
  onLastPage?: () => void;
  /** Contenido bajo el aviso de error (p. ej. la marca manual de revisada). */
  errorExtra?: ReactNode;
}) {
  const pdf = useSignedPdf(fetchUrl, sourceKey);
  const [index, setIndex] = useState(0);
  const [drawFailure, setDrawFailure] = useState<{ key: string; failure: PdfFailure } | null>(null);
  const renewed = useRef(false);
  const reported = useRef(false);
  const state = pdf.state;
  const total = state.status === 'ready' ? state.document.numPages : 0;
  const page = Math.min(index, Math.max(total - 1, 0));

  function handleFailure(error: unknown) {
    const failure = classifyPdfError(error);
    // Una URL vencida (o un corte) se arregla pidiendo otra y reabriendo, una sola vez.
    if ((failure.kind === 'expired' || failure.kind === 'network') && !renewed.current) {
      renewed.current = true;
      void pdf.renew();
      return;
    }
    setDrawFailure({ key: sourceKey, failure });
  }

  function handleDrawn(pageNumber: number) {
    renewed.current = false;
    if (drawFailure) {
      setDrawFailure(null);
    }
    if (pageNumber === total && !reported.current) {
      reported.current = true;
      onLastPage?.();
    }
  }

  function retry() {
    renewed.current = false;
    setDrawFailure(null);
    pdf.reload();
  }

  if (state.status === 'loading') {
    return <PdfLoading percent={state.percent} />;
  }
  if (state.status === 'error') {
    return (
      <PdfFailureView failure={state.failure} name={name} fetchUrl={fetchUrl} onRetry={retry}>
        {errorExtra}
      </PdfFailureView>
    );
  }
  if (drawFailure && drawFailure.key === sourceKey) {
    return (
      <PdfFailureView
        failure={{ source: 'pdf', failure: drawFailure.failure }}
        name={name}
        fetchUrl={fetchUrl}
        onRetry={retry}
      >
        {errorExtra}
      </PdfFailureView>
    );
  }

  return (
    <DeckFrame
      name={name}
      index={page}
      total={total}
      counterLabel={`Página ${page + 1} de ${total}`}
      onGo={setIndex}
      actions={<DownloadButton name={name} pdfDocument={state.document} fetchUrl={fetchUrl} />}
    >
      {(fullscreen) => (
        <PdfStage
          pdfDocument={state.document}
          pageNumber={page + 1}
          name={name}
          fullscreen={fullscreen}
          onDrawn={handleDrawn}
          onFailure={handleFailure}
        />
      )}
    </DeckFrame>
  );
}
