import type { ConsentBox, ConsentBoxKey } from '@/shared/legal';

export type ConsentChecks = Record<ConsentBoxKey, boolean>;

/** Casillas sin marcar, en el orden del aviso. */
export function missingBoxes(boxes: readonly ConsentBox[], checked: ConsentChecks): ConsentBox[] {
  return boxes.filter((box) => !checked[box.key]);
}

/** Texto que explica qué falta para habilitar «Acepto y continuar»; `null` si no falta nada. */
export function missingConsentMessage(
  boxes: readonly ConsentBox[],
  checked: ConsentChecks,
): string | null {
  const names = missingBoxes(boxes, checked).map((box) => box.shortName);
  if (names.length === 0) {
    return null;
  }
  const list =
    names.length === 1
      ? names.join('')
      : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  return `Falta marcar: ${list}.`;
}
