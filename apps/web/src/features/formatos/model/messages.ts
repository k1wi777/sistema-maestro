/**
 * Convierte el motivo de un esquema de `@gns/shared` («es obligatorio», «debe tener como máximo 80
 * caracteres») en una frase para pintar junto al campo. Los motivos nunca contienen el valor
 * rechazado (puede ser el dato de un menor), así que no hay nada que quitar aquí.
 */
export function sentence(reason: string): string {
  const text = reason.trim();
  if (text === '') {
    return 'El valor no es válido.';
  }
  const capitalized = text.charAt(0).toLocaleUpperCase('es') + text.slice(1);
  return /[.!?»]$/u.test(capitalized) ? capitalized : `${capitalized}.`;
}

/** Errores de un formulario por campo y los que no corresponden a ninguno (van en un aviso). */
export interface FieldErrors<Field extends string> {
  fields: Partial<Record<Field, string>>;
  other: string[];
}

/**
 * Traslada los errores `{ field, reason }` de un 400 a los campos del formulario; `field` puede
 * traer un índice o un subcampo («students.0») y se reduce a su primer tramo.
 */
export function mapFieldErrors<Field extends string>(
  errors: readonly { field: string; reason: string }[] | undefined,
  known: readonly Field[],
): FieldErrors<Field> {
  const fields: Partial<Record<Field, string>> = {};
  const other: string[] = [];
  for (const { field, reason } of errors ?? []) {
    const root = field.split('.')[0];
    const match = known.find((name) => name === root);
    if (match) {
      fields[match] ??= sentence(reason);
    } else {
      other.push(sentence(reason));
    }
  }
  return { fields, other };
}
