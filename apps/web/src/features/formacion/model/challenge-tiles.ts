import { ChallengeQuestionType, type ChallengeQuestionPayload } from '@gns/shared';

import type { ChallengeAnswer } from './challenge';

export type TileColor = 'red' | 'blue' | 'yellow' | 'green';
export type TileShape = 'triangle' | 'diamond' | 'circle' | 'square';

interface TileStyle {
  color: TileColor;
  shape: TileShape;
}

export interface ChallengeTile {
  key: string;
  label: string;
  color: TileColor;
  shape: TileShape;
  answer: ChallengeAnswer;
}

/** Colores y figuras en el orden en que llegan las opciones: rojo, azul, amarillo y verde. */
const RED: TileStyle = { color: 'red', shape: 'triangle' };
const TILE_STYLES: readonly TileStyle[] = [
  RED,
  { color: 'blue', shape: 'diamond' },
  { color: 'yellow', shape: 'circle' },
  { color: 'green', shape: 'square' },
];

const tileStyle = (index: number): TileStyle => TILE_STYLES[index % TILE_STYLES.length] ?? RED;

/**
 * Fichas de una pregunta de opción múltiple o de verdadero o falso. Verdadero o falso siempre usa
 * dos fichas («Verdadero» y «Falso»); la de orden no usa fichas.
 */
export function challengeTiles(question: ChallengeQuestionPayload): ChallengeTile[] {
  if (question.type === ChallengeQuestionType.TrueFalse) {
    return [
      { key: 'true', label: 'Verdadero', answer: { value: true }, ...tileStyle(0) },
      { key: 'false', label: 'Falso', answer: { value: false }, ...tileStyle(1) },
    ];
  }
  if (question.type === ChallengeQuestionType.Ordering) {
    return [];
  }
  return (question.options ?? []).map((option, index) => ({
    key: option.id,
    label: option.text,
    answer: { optionId: option.id },
    ...tileStyle(index),
  }));
}

/** ¿Esta ficha es la respuesta que la API marcó como correcta? */
export function isSameAnswer(a: ChallengeAnswer | null, b: ChallengeAnswer | null): boolean {
  if (a === null || b === null) {
    return false;
  }
  if ('optionId' in a && 'optionId' in b) {
    return a.optionId === b.optionId;
  }
  if ('value' in a && 'value' in b) {
    return a.value === b.value;
  }
  return false;
}

/** Texto de cada paso en el orden correcto que devolvió la API, para mostrarlo tras calificar. */
export function orderedTexts(
  question: ChallengeQuestionPayload,
  correct: ChallengeAnswer,
): string[] {
  if (!('optionIds' in correct)) {
    return [];
  }
  const byId = new Map((question.options ?? []).map((option) => [option.id, option.text]));
  return correct.optionIds.map((id) => byId.get(id) ?? '');
}
