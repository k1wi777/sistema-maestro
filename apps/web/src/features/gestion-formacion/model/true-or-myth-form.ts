import type { TrueOrMythConfig } from '@gns/shared';

import { numberText, parseDecimal, requiredNumber } from './form-numbers';

export interface StatementForm {
  text: string;
  isTrue: boolean;
  explanation: string;
}

export interface TrueOrMythForm {
  statements: StatementForm[];
  perGame: string;
  lives: string;
  seconds: string;
  threshold: string;
}

export function emptyStatement(): StatementForm {
  return { text: '', isTrue: true, explanation: '' };
}

/** Valores de la demo. */
export function initialTrueOrMythForm(): TrueOrMythForm {
  return {
    statements: [emptyStatement()],
    perGame: '10',
    lives: '3',
    seconds: '10',
    threshold: '80',
  };
}

export function trueOrMythToForm(config: TrueOrMythConfig): TrueOrMythForm {
  return {
    statements: config.afirmaciones.map((statement) => ({
      text: statement.texto,
      isTrue: statement.es_verdad,
      explanation: statement.explicacion,
    })),
    perGame: numberText(config.por_partida),
    lives: numberText(config.vidas),
    seconds: numberText(config.segundos_por_afirmacion),
    threshold: numberText(config.umbral_aprobacion),
  };
}

export function trueOrMythFromForm(form: TrueOrMythForm): unknown {
  return {
    afirmaciones: form.statements.map((statement) => ({
      texto: statement.text.trim(),
      es_verdad: statement.isTrue,
      explicacion: statement.explanation.trim(),
    })),
    por_partida: requiredNumber(form.perGame),
    vidas: requiredNumber(form.lives),
    segundos_por_afirmacion: requiredNumber(form.seconds),
    umbral_aprobacion: requiredNumber(form.threshold),
  };
}

/** Aviso vivo cuando la partida pide más afirmaciones de las escritas; `null` si todo cuadra. */
export function perGameHint(form: TrueOrMythForm): string | null {
  const perGame = parseDecimal(form.perGame);
  const have = form.statements.length;
  if (perGame !== undefined && Number.isFinite(perGame) && perGame > have) {
    return `La partida pide ${perGame} afirmaciones y solo hay ${have} escritas.`;
  }
  return null;
}
