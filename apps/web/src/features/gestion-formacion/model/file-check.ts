import { MODULE_FILE_POLICY, moduleFileViolation, type ModuleFilePurpose } from '@gns/shared';

const MEGABYTE = 1024 * 1024;

/** Qué formatos se aceptan, escritos para la persona (la política exacta es la de `@gns/shared`). */
export const ACCEPTED_FORMATS: Record<ModuleFilePurpose, string> = {
  video: 'MP4 o WebM',
  presentacion: 'PDF, imagen (PNG, JPG o WebP) o PPTX',
};

/** Valor del atributo `accept` del selector de archivos. */
export function acceptAttribute(purpose: ModuleFilePurpose): string {
  return MODULE_FILE_POLICY[purpose].contentTypes.join(',');
}

export function maxMegabytes(purpose: ModuleFilePurpose): number {
  return Math.round(MODULE_FILE_POLICY[purpose].maxBytes / MEGABYTE);
}

/**
 * Valida tipo y tamaño antes de subir (con la misma política que la API). Devuelve el motivo para
 * mostrarlo junto al campo, o `null` si el archivo se puede subir.
 */
export function fileProblem(
  purpose: ModuleFilePurpose,
  file: { type: string; size: number },
): string | null {
  if (file.size === 0) {
    return 'El archivo está vacío.';
  }
  const violation = moduleFileViolation(purpose, file.type, file.size);
  if (!violation) {
    return null;
  }
  return violation.field === 'contentType'
    ? `Este tipo de archivo no está permitido. Usa ${ACCEPTED_FORMATS[purpose]}.`
    : `El archivo supera el máximo de ${maxMegabytes(purpose)} MB.`;
}

/** Tamaño legible: «850 KB», «1,4 MB». */
export function formatFileSize(bytes: number): string {
  if (bytes < MEGABYTE) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  const megabytes = bytes / MEGABYTE;
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(megabytes)} MB`;
}
