/**
 * Letras con marca que la búsqueda trata como su letra base, en mayúscula y minúscula.
 * `SEARCH_FOLD_FROM` y `SEARCH_FOLD_TO` tienen la misma longitud y se usan como los dos
 * últimos argumentos de `translate()` de PostgreSQL, de modo que la columna y el término
 * se plieguen igual (`foldSearchText` hace lo mismo en TypeScript).
 */
export const SEARCH_FOLD_FROM = 'áàâäéèêëíìîïóòôöúùûüñçÁÀÂÄÉÈÊËÍÌÎÏÓÒÔÖÚÙÛÜÑÇ';
export const SEARCH_FOLD_TO = 'aaaaeeeeiiiioooouuuuncAAAAEEEEIIIIOOOOUUUUNC';

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
export const SEARCH_MAX_WORDS = 5;

/** Quita las marcas diacríticas (tildes, diéresis, `ñ`, `ç`); no cambia mayúsculas. */
export function foldSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Palabras de la búsqueda, sin plegar y sin repetir: como máximo `SEARCH_MAX_WORDS`. */
export function searchWords(text: string): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  return [...new Set(words)].slice(0, SEARCH_MAX_WORDS);
}
