import { ChallengeQuestionType } from '@gns/shared';

import type { ChallengePhase } from './challenge';

export type ChallengeKeyAction =
  | { type: 'pick'; index: number }
  | { type: 'place'; index: number }
  | { type: 'unplaceLast' }
  | { type: 'confirm' }
  | { type: 'advance' };

export interface ChallengeKeyInput {
  key: string;
  phase: ChallengePhase;
  questionType: ChallengeQuestionType | null;
  /** Fichas u opciones visibles de la pregunta. */
  optionCount: number;
  /** Cuántas opciones lleva ya colocadas una pregunta de orden. */
  placedCount?: number;
}

/** Fichas de la pregunta de opción múltiple y de orden: las teclas llegan hasta 4 y hasta 5. */
const MAX_TILE_KEY = 4;
const MAX_ORDER_KEY = 5;

/**
 * Traduce una tecla en la acción del Desafío según el tipo de pregunta y la fase: 1–4 eligen ficha,
 * en orden 1–5 colocan, Retroceso quita la última, Enter confirma o pasa a la siguiente pregunta.
 * Devuelve `null` si la tecla no hace nada en ese momento.
 */
export function challengeKeyAction(input: ChallengeKeyInput): ChallengeKeyAction | null {
  const { key, phase, questionType, optionCount, placedCount = 0 } = input;
  if (phase === 'answered') {
    return key === 'Enter' ? { type: 'advance' } : null;
  }
  if (phase !== 'question' || questionType === null) {
    return null;
  }
  const digit = /^[1-9]$/.test(key) ? Number(key) : null;
  if (questionType === ChallengeQuestionType.Ordering) {
    if (digit !== null && digit <= Math.min(MAX_ORDER_KEY, optionCount)) {
      return { type: 'place', index: digit - 1 };
    }
    if (key === 'Backspace') {
      return { type: 'unplaceLast' };
    }
    return key === 'Enter' && placedCount === optionCount ? { type: 'confirm' } : null;
  }
  if (digit !== null && digit <= Math.min(MAX_TILE_KEY, optionCount)) {
    return { type: 'pick', index: digit - 1 };
  }
  return null;
}
