import type { IconName } from './registry';

/** Selector de variación U+FE0F: la demo guarda algunos emojis con él y otros sin él. */
const VARIATION_SELECTOR = /\uFE0F/g;

/** Icono genérico para un emoji ausente o desconocido: nunca se pinta el emoji como texto. */
export const GENERIC_ICON: IconName = 'estrella';

/** Icono elegible por coordinación, con su nombre en español y el emoji canónico que se guarda. */
export interface PickableIcon {
  icon: IconName;
  label: string;
  emoji: string;
}

/** Los catorce iconos de la demo (nombres del tablero) más la estrella, en el orden del selector. */
export const PICKABLE_ICONS: readonly PickableIcon[] = [
  { icon: 'ahorro', label: 'Alcancía', emoji: '🐷' },
  { icon: 'medalla', label: 'Medalla', emoji: '🏅' },
  { icon: 'idiomas', label: 'Idiomas', emoji: '🗣' },
  { icon: 'acuerdo', label: 'Acuerdo', emoji: '🤝' },
  { icon: 'pastel', label: 'Pastel', emoji: '🎂' },
  { icon: 'tendencia', label: 'Tendencia', emoji: '📈' },
  { icon: 'birrete', label: 'Birrete', emoji: '🎓' },
  { icon: 'sol', label: 'Sol', emoji: '🏖' },
  { icon: 'morral', label: 'Morral', emoji: '🎒' },
  { icon: 'cubiertos', label: 'Cubiertos', emoji: '🍽' },
  { icon: 'tiquete', label: 'Tiquete', emoji: '🎟' },
  { icon: 'bebe', label: 'Bebé', emoji: '👶' },
  { icon: 'salvavidas', label: 'Salvavidas', emoji: '🛟' },
  { icon: 'megafono', label: 'Megáfono', emoji: '📣' },
  { icon: 'estrella', label: 'Estrella', emoji: '⭐' },
];

const EMOJI_ICON: Readonly<Record<string, IconName>> = Object.fromEntries(
  PICKABLE_ICONS.map((item) => [item.emoji, item.icon]),
);

/** Emoji sin selector de variación y sin espacios, para comparar. */
function normalizeEmoji(emoji: string): string {
  return emoji.replace(VARIATION_SELECTOR, '').trim();
}

/**
 * Icono del sistema de diseño para el emoji que coordinación guarda en la configuración de una
 * tarjeta, un concepto o un simulador (los catorce de la demo, como en el tablero).
 */
export function emojiIcon(emoji: string | null | undefined): IconName {
  if (!emoji) {
    return GENERIC_ICON;
  }
  return EMOJI_ICON[normalizeEmoji(emoji)] ?? GENERIC_ICON;
}

/** Emoji canónico (sin selector de variación) con el que se guarda un icono elegible. */
export function iconEmoji(icon: IconName): string | undefined {
  return PICKABLE_ICONS.find((item) => item.icon === icon)?.emoji;
}

/** ¿El emoji tiene un icono elegible equivalente? */
export function hasIconEquivalent(emoji: string | null | undefined): boolean {
  return Boolean(emoji) && normalizeEmoji(emoji as string) in EMOJI_ICON;
}
