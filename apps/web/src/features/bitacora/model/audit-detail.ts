export const NO_DATA = 'Sin datos';

export interface DetailRow {
  field: string;
  before: string | null;
  after: string | null;
}

export type AuditDataView =
  | { kind: 'rows'; rows: DetailRow[]; missing: ('before' | 'after')[] }
  | { kind: 'json'; before: string; after: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Texto de un valor: las cadenas tal cual y lo demás como JSON compacto. */
function formatValue(value: unknown): string {
  return typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value));
}

function formatBlock(value: unknown): string {
  return value === null || value === undefined ? NO_DATA : JSON.stringify(value, null, 2);
}

/**
 * Datos antes y después tal como los devolvió la API. Si cada lado es nulo o un objeto plano (y
 * alguno es objeto) se arman filas «campo · antes · después» con la unión de claves, valores
 * anidados como JSON compacto; cualquier otra forma se muestra como JSON formateado. No traduce
 * nombres de campo ni completa lo que la API ocultó.
 */
export function describeAuditData(before: unknown, after: unknown): AuditDataView {
  const beforeOk = before === null || before === undefined || isPlainObject(before);
  const afterOk = after === null || after === undefined || isPlainObject(after);
  if (beforeOk && afterOk && (isPlainObject(before) || isPlainObject(after))) {
    const left = isPlainObject(before) ? before : {};
    const right = isPlainObject(after) ? after : {};
    const fields = [...new Set([...Object.keys(left), ...Object.keys(right)])];
    return {
      kind: 'rows',
      rows: fields.map((field) => ({
        field,
        before: field in left ? formatValue(left[field]) : null,
        after: field in right ? formatValue(right[field]) : null,
      })),
      missing: [
        ...(isPlainObject(before) ? [] : (['before'] as const)),
        ...(isPlainObject(after) ? [] : (['after'] as const)),
      ],
    };
  }
  return { kind: 'json', before: formatBlock(before), after: formatBlock(after) };
}
