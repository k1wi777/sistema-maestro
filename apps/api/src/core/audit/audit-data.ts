export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const REDACTED = '[oculto]';
export const AUDIT_DATA_MAX_BYTES = 64 * 1024;

// Se compara el nombre sin mayúsculas ni separadores (`password_hash` = `passwordHash`).
const SECRET_KEYS = new Set([
  'password',
  'passwordhash',
  'contrasena',
  'contrasenahash',
  'hash',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
]);

function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

function redact(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value !== null && typeof value === 'object') {
    // Se marca en lugar de quitar: quien audita ve que el campo cambió sin ver su valor.
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        isSecretKey(key) ? REDACTED : redact(inner),
      ]),
    );
  }
  return value;
}

/** Normaliza a JSON (Date a ISO, BigInt a texto) y oculta los valores de campos secretos. */
export function normalizeAuditData(value: unknown): JsonValue {
  const json = JSON.stringify(value, (_key, inner: unknown) =>
    typeof inner === 'bigint' ? inner.toString() : inner,
  ) as string | undefined;
  return json === undefined ? null : redact(JSON.parse(json) as JsonValue);
}

/** Si el JSON supera el tope, se guarda solo la lista de campos en lugar de los datos. */
export function limitAuditData(data: JsonValue, maxBytes = AUDIT_DATA_MAX_BYTES): JsonValue {
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') <= maxBytes) {
    return data;
  }
  const fields =
    data !== null && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : [];
  return { _omitido: `excede ${String(maxBytes / 1024)} KB`, campos: fields };
}

/** Normaliza, oculta secretos y limita el tamaño: lo que se escribe en `datos_antes/despues`. */
export function prepareAuditData(value: unknown): JsonValue | null {
  if (value === null || value === undefined) {
    return null;
  }
  return limitAuditData(normalizeAuditData(value));
}

/**
 * Para modificaciones: deja en cada lado solo las claves de primer nivel cuyo valor
 * cambió (comparación estructural de los valores ya normalizados).
 */
export function diffFirstLevel(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: JsonObject; after: JsonObject } {
  const normalizedBefore = normalizeAuditData(before) as JsonObject;
  const normalizedAfter = normalizeAuditData(after) as JsonObject;
  const rawBefore = JSON.parse(JSON.stringify(before, bigintToText)) as JsonObject;
  const rawAfter = JSON.parse(JSON.stringify(after, bigintToText)) as JsonObject;
  const changedBefore: JsonObject = {};
  const changedAfter: JsonObject = {};
  for (const key of new Set([...Object.keys(normalizedBefore), ...Object.keys(normalizedAfter)])) {
    // Se compara el valor original: un secreto ya está oculto en ambos lados y no
    // permitiría saber si cambió.
    if (JSON.stringify(rawBefore[key]) === JSON.stringify(rawAfter[key])) {
      continue;
    }
    if (key in normalizedBefore) changedBefore[key] = normalizedBefore[key] as JsonValue;
    if (key in normalizedAfter) changedAfter[key] = normalizedAfter[key] as JsonValue;
  }
  return { before: changedBefore, after: changedAfter };
}

function bigintToText(_key: string, inner: unknown): unknown {
  return typeof inner === 'bigint' ? inner.toString() : inner;
}

/**
 * Detalle de la fila de bitácora: el texto de `detailFromBody` en el cuerpo (recortado) si
 * lo hay; si no, `detail`. El cuerpo ya lo validó el esquema del endpoint cuando la acción
 * terminó con éxito.
 */
export function resolveAuditDetail(
  options: { detail?: string; detailFromBody?: string },
  body: unknown,
): string | null {
  if (options.detailFromBody && typeof body === 'object' && body !== null) {
    const value = (body as Record<string, unknown>)[options.detailFromBody];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return options.detail ?? null;
}
