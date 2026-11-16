import type { WheelPassportConfig } from '@gns/shared';

/** Emoji de una tarjeta nueva: la estrella, que es un icono elegible. */
export const DEFAULT_CARD_EMOJI = '⭐';

const MAX_KEY_LENGTH = 32;

export interface WheelCardForm {
  /** Clave técnica; `null` en una tarjeta nueva hasta guardarla (nunca se recalcula después). */
  key: string | null;
  emoji: string;
  shortTitle: string;
  title: string;
  fact: string;
  /** Un hecho por línea. */
  facts: string;
  linkText: string;
  linkUrl: string;
  question: string;
  options: string[];
  /** Posición de la opción correcta; `null` si no se ha marcado. */
  correct: number | null;
}

export interface WheelForm {
  badge: string;
  cards: WheelCardForm[];
}

export function emptyCard(): WheelCardForm {
  return {
    key: null,
    emoji: DEFAULT_CARD_EMOJI,
    shortTitle: '',
    title: '',
    fact: '',
    facts: '',
    linkText: '',
    linkUrl: '',
    question: '',
    options: ['', ''],
    correct: 0,
  };
}

export function initialWheelForm(): WheelForm {
  return { badge: '', cards: [emptyCard(), emptyCard()] };
}

export function wheelToForm(config: WheelPassportConfig): WheelForm {
  return {
    badge: config.insignia,
    cards: config.tarjetas.map((card) => ({
      key: card.clave,
      emoji: card.emoji,
      shortTitle: card.titulo_corto,
      title: card.titulo,
      fact: card.dato,
      facts: card.hechos.join('\n'),
      linkText: card.enlace?.texto ?? '',
      linkUrl: card.enlace?.url ?? '',
      question: card.pregunta.enunciado,
      options: [...card.pregunta.opciones],
      correct: card.pregunta.correcta,
    })),
  };
}

/**
 * Clave técnica derivada del título corto: minúsculas, sin tildes, lo que no sea `a-z0-9` pasa a
 * `_`, prefijo `t_` si no empieza por letra, máximo 32 y sufijo `_2`, `_3`… si ya existe.
 */
export function cardKey(shortTitle: string, used: ReadonlySet<string>): string {
  const slug = shortTitle
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = /^[a-z]/.test(slug) ? slug : `t_${slug || 'tarjeta'}`;
  const trimmed = base.slice(0, MAX_KEY_LENGTH).replace(/_+$/, '') || 't_tarjeta';
  if (!used.has(trimmed)) {
    return trimmed;
  }
  for (let n = 2; ; n += 1) {
    const suffix = `_${n}`;
    const candidate = `${trimmed.slice(0, MAX_KEY_LENGTH - suffix.length)}${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
}

/** Una línea por hecho; las vacías se descartan. */
export function factLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * Candidato para el esquema compartido. Las tarjetas nuevas reciben su clave aquí, sin repetir las
 * que ya tienen otras tarjetas, y las existentes conservan la suya aunque cambie su título.
 */
export function wheelFromForm(form: WheelForm): unknown {
  const used = new Set(form.cards.flatMap((card) => (card.key === null ? [] : [card.key])));
  return {
    insignia: form.badge.trim(),
    tarjetas: form.cards.map((card) => {
      let key = card.key;
      if (key === null) {
        key = cardKey(card.shortTitle, used);
        used.add(key);
      }
      const noLink = card.linkText.trim() === '' && card.linkUrl.trim() === '';
      return {
        clave: key,
        emoji: card.emoji,
        titulo_corto: card.shortTitle.trim(),
        titulo: card.title.trim(),
        dato: card.fact.trim(),
        hechos: factLines(card.facts),
        ...(noLink ? {} : { enlace: { texto: card.linkText.trim(), url: card.linkUrl.trim() } }),
        pregunta: {
          enunciado: card.question.trim(),
          opciones: card.options.map((option) => option.trim()),
          correcta: card.correct ?? -1,
        },
      };
    }),
  };
}

/** Quita una opción ajustando la correcta: si era la correcta, queda sin marcar. */
export function removeOption(card: WheelCardForm, index: number): WheelCardForm {
  const options = card.options.filter((_, position) => position !== index);
  let correct = card.correct;
  if (correct !== null) {
    correct = correct === index ? null : correct > index ? correct - 1 : correct;
  }
  return { ...card, options, correct };
}
