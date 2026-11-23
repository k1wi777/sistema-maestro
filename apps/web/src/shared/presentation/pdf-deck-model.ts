/**
 * Lógica pura del visor de PDF (sin DOM ni pdf.js): límites de página, escala de dibujo y
 * clasificación de errores. El componente solo la usa.
 */

/** Tope de densidad de píxeles: más allá no se nota y el canvas pesa el doble. */
export const MAX_DEVICE_PIXEL_RATIO = 2;

/** Safari en iOS rechaza canvas de más de unos 16 millones de píxeles. */
export const MAX_CANVAS_PIXELS = 16_000_000;

/** Lleva un número de página (base 1) al rango válido del documento. */
export function clampPage(page: number, total: number): number {
  if (total < 1) {
    return 1;
  }
  return Math.min(total, Math.max(1, Math.round(page)));
}

export interface RenderPlan {
  /** Tamaño en píxeles CSS con el que se muestra la página. */
  cssWidth: number;
  cssHeight: number;
  /** Escala de pdf.js (unidades del PDF a píxeles del canvas). */
  scale: number;
}

/**
 * Escala la página para que quepa en el ancho del contenedor y en una altura máxima (contain), y
 * calcula la escala del canvas con la densidad de la pantalla acotada por el tope de píxeles.
 */
export function planRender({
  pageWidth,
  pageHeight,
  containerWidth,
  maxHeight,
  devicePixelRatio,
}: {
  pageWidth: number;
  pageHeight: number;
  containerWidth: number;
  maxHeight: number;
  devicePixelRatio: number;
}): RenderPlan {
  const fit = Math.min(containerWidth / pageWidth, maxHeight / pageHeight);
  const density = Math.min(Math.max(devicePixelRatio, 1), MAX_DEVICE_PIXEL_RATIO);
  let scale = fit * density;
  const pixels = pageWidth * scale * (pageHeight * scale);
  if (pixels > MAX_CANVAS_PIXELS) {
    scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
  }
  return { cssWidth: pageWidth * fit, cssHeight: pageHeight * fit, scale };
}

export type PdfFailureKind = 'invalid' | 'password' | 'expired' | 'network';

export interface PdfFailure {
  kind: PdfFailureKind;
  message: string;
}

export const PDF_FAILURE_MESSAGE: Record<PdfFailureKind, string> = {
  invalid: 'No pudimos abrir el PDF: el archivo parece dañado.',
  password: 'El PDF está protegido con contraseña: descárgalo para verlo.',
  expired: 'No pudimos cargar la presentación. Revisa tu conexión.',
  network: 'No pudimos cargar la presentación. Revisa tu conexión.',
};

/** Respuestas con las que el almacenamiento rechaza una URL firmada vencida. */
const EXPIRED_STATUSES = new Set([400, 401, 403]);

function nameOf(error: unknown): string {
  return typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
}

/**
 * Clasifica el error de pdf.js por su nombre (así no se importa pdf.js aquí). `expired` es lo que
 * justifica pedir una URL nueva; el resto (red incluida) se muestra con «Reintentar».
 */
export function classifyPdfError(error: unknown): PdfFailure {
  const name = nameOf(error);
  let kind: PdfFailureKind = 'network';
  if (name === 'InvalidPDFException' || name === 'FormatError') {
    kind = 'invalid';
  } else if (name === 'PasswordException') {
    kind = 'password';
  } else if (name === 'ResponseException') {
    const status = (error as { status?: unknown }).status;
    kind = typeof status === 'number' && EXPIRED_STATUSES.has(status) ? 'expired' : 'network';
  }
  return { kind, message: PDF_FAILURE_MESSAGE[kind] };
}

/** La cancelación de un dibujo (por cambiar de página) no es un fallo. */
export function isCancellation(error: unknown): boolean {
  const name = nameOf(error);
  return name === 'RenderingCancelledException' || name === 'AbortException';
}

/** Porcentaje entero de descarga, o `null` si no se conoce el tamaño. */
export function loadPercent(loaded: number, total: number | undefined): number | null {
  if (!total || total <= 0) {
    return null;
  }
  return Math.min(100, Math.floor((loaded / total) * 100));
}
