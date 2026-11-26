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

/** Todas las casillas marcadas. */
export function allChecked(boxes: readonly ConsentBox[], checked: ConsentChecks): boolean {
  return boxes.every((box) => checked[box.key]);
}

/** Solo algunas marcadas (ni ninguna ni todas): el estado mixto de «Marcar todo». */
export function someChecked(boxes: readonly ConsentBox[], checked: ConsentChecks): boolean {
  return boxes.some((box) => checked[box.key]) && !allChecked(boxes, checked);
}

/** «Marcar todo»: si ya están todas las desmarca; si falta alguna, las marca todas. */
export function toggleAll(boxes: readonly ConsentBox[], checked: ConsentChecks): ConsentChecks {
  const next = !allChecked(boxes, checked);
  return { ...checked, ...Object.fromEntries(boxes.map((box) => [box.key, next])) };
}
