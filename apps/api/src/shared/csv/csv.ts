/** Separador de columnas: `;` para que Excel con configuración regional es-CO abra las columnas. */
export const CSV_SEPARATOR = ';';

/** Marca de orden de bytes UTF-8: Excel la necesita para mostrar bien tildes y eñes. */
export const CSV_BOM = '﻿';

const LINE_BREAK = '\r\n';

// Excel interpreta como fórmula una celda que empieza por estos caracteres (inyección de fórmulas).
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[;"\r\n]/;

export type CsvValue = string | number | null | undefined;

/**
 * Una celda lista para escribir. Los textos que empiezan por `=`, `+`, `-`, `@`, tabulador o
 * retorno se neutralizan anteponiendo `'` (Excel los muestra como texto); después se entrecomilla
 * lo que contenga `;`, comillas o saltos de línea, duplicando las comillas. Los números se
 * escriben tal cual: no son texto controlado por un usuario.
 */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** CSV con BOM, `;` y saltos `\r\n`: encabezados primero, una línea por fila. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(CSV_SEPARATOR));
  return `${CSV_BOM}${lines.join(LINE_BREAK)}${LINE_BREAK}`;
}
