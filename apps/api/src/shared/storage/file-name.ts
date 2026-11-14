const MAX_LENGTH = 100;

/**
 * Nombre apto para `Content-Disposition`: ASCII, sin comillas, barras ni caracteres de control.
 * El nombre original (con tildes) se conserva en la base de datos.
 */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .replace(/^[. ]+/, '')
    .trim()
    .slice(0, MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : 'archivo';
}
