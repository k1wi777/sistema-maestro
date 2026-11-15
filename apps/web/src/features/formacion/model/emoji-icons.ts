import type { IconName } from '@/shared/ui';

/** Selector de variación U+FE0F: la demo guarda algunos emojis con él y otros sin él. */
const VARIATION_SELECTOR = /\uFE0F/g;

/** Icono genérico para un emoji ausente o desconocido: nunca se pinta el emoji como texto. */
export const GENERIC_ICON: IconName = 'estrella';

const EMOJI_ICON: Readonly<Record<string, IconName>> = {
  '🐷': 'ahorro',
  '🏅': 'medalla',
  '🗣': 'idiomas',
  '🤝': 'acuerdo',
  '🎂': 'pastel',
  '📈': 'tendencia',
  '🎓': 'birrete',
  '🏖': 'sol',
  '🎒': 'morral',
  '🍽': 'cubiertos',
  '🎟': 'tiquete',
  '👶': 'bebe',
  '🛟': 'salvavidas',
  '📣': 'megafono',
};

/**
 * Icono del sistema de diseño para el emoji que coordinación guarda en la configuración de una
 * tarjeta, un concepto o un simulador (los catorce de la demo, como en el tablero).
 */
export function emojiIcon(emoji: string | null | undefined): IconName {
  if (!emoji) {
    return GENERIC_ICON;
  }
  return EMOJI_ICON[emoji.replace(VARIATION_SELECTOR, '').trim()] ?? GENERIC_ICON;
}
