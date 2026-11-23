import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFWorker } from 'pdfjs-dist';

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let library: Promise<PdfJs> | null = null;

/**
 * pdf.js toca APIs del navegador (`DOMMatrix`, `Path2D`) al evaluarse: se importa con `import()`
 * solo cuando se monta un visor de PDF (nunca en el servidor ni al cargar el resto de la app) y
 * en su propio fragmento. Se usa la build «legacy», que admite navegadores móviles menos recientes.
 */
function loadPdfJs(): Promise<PdfJs> {
  library ??= import('pdfjs-dist/legacy/build/pdf.mjs').catch((error: unknown) => {
    library = null;
    throw error;
  });
  return library;
}

export interface PdfHandle {
  /** El documento abierto; falla con la excepción de pdf.js si no se puede abrir. */
  promise: Promise<PDFDocumentProxy>;
  /** Cancela la descarga, libera el documento y termina su worker. Se puede llamar en cualquier momento. */
  destroy: () => Promise<void>;
}

/**
 * Abre el PDF de una URL firmada. Cada documento usa su propio worker (del mismo origen, con
 * hash y caché bajo `/_next/static`), que se termina al cerrarlo: así dos visores o el doble
 * montaje de desarrollo nunca se disputan un mismo worker.
 *
 * `disableAutoFetch` evita bajar el archivo entero: con rangos solo se pide lo que cada página
 * necesita. pdf.js no ejecuta JavaScript del PDF (el sandbox no se carga) y las anotaciones y
 * formularios activos no se dibujan.
 */
export function openPdf(
  url: string,
  onProgress?: (loaded: number, total: number | undefined) => void,
): PdfHandle {
  let destroyed = false;
  let task: PDFDocumentLoadingTask | null = null;
  let pdfWorker: PDFWorker | null = null;
  let worker: Worker | null = null;

  const promise = (async () => {
    const pdfjs = await loadPdfJs();
    if (destroyed) {
      throw new DOMException('Apertura cancelada', 'AbortError');
    }
    worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
    pdfWorker = pdfjs.PDFWorker.create({ port: worker });
    task = pdfjs.getDocument({
      url,
      worker: pdfWorker,
      disableAutoFetch: true,
      withCredentials: false,
      enableXfa: false,
    });
    task.onProgress = ({ loaded, total }: { loaded: number; total?: number }) =>
      onProgress?.(loaded, total);
    return task.promise;
  })();

  async function destroy() {
    destroyed = true;
    // Una apertura que falla ya dejó su worker; destruir es idempotente.
    await task?.destroy().catch(() => undefined);
    pdfWorker?.destroy();
    worker?.terminate();
  }

  return { promise, destroy };
}
