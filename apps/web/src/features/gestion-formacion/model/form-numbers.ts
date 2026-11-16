/**
 * Número escrito en un campo de texto: admite coma o punto decimal y espacios. Vacío → ausente;
 * texto que no es un número → `NaN`, que el esquema compartido rechaza con su mensaje.
 */
export function parseDecimal(text: string): number | undefined {
  const clean = text.replace(/\s/g, '').replace(',', '.');
  if (clean === '') {
    return undefined;
  }
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(clean) ? Number(clean) : Number.NaN;
}

/** Número del esquema como texto del formulario. */
export function numberText(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

/** Número obligatorio del candidato: vacío cuenta como no numérico, para que lo rechace el esquema. */
export function requiredNumber(text: string): number {
  return parseDecimal(text) ?? Number.NaN;
}

/** Texto opcional del candidato: vacío → se omite la propiedad. */
export function optionalText(text: string): string | undefined {
  const clean = text.trim();
  return clean === '' ? undefined : clean;
}
