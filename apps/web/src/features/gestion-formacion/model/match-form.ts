import type { MatchConfig } from '@gns/shared';

import { numberText, optionalText, parseDecimal, requiredNumber } from './form-numbers';

export interface PairForm {
  concept: string;
  fact: string;
  /** Emoji guardado; `undefined` es «sin icono». */
  emoji: string | undefined;
}

export interface MatchForm {
  pairs: PairForm[];
  perRound: string;
  rounds: string;
  seconds: string;
  threshold: string;
}

export function emptyPair(): PairForm {
  return { concept: '', fact: '', emoji: undefined };
}

/** Valores de la demo; las reglas cruzadas se muestran como error hasta completarlas. */
export function initialMatchForm(): MatchForm {
  return {
    pairs: [emptyPair(), emptyPair()],
    perRound: '5',
    rounds: '2',
    seconds: '45',
    threshold: '80',
  };
}

export function matchToForm(config: MatchConfig): MatchForm {
  return {
    pairs: config.pares.map((pair) => ({
      concept: pair.concepto,
      fact: pair.dato,
      emoji: pair.emoji,
    })),
    perRound: numberText(config.pares_por_ronda),
    rounds: numberText(config.rondas),
    seconds: numberText(config.segundos_por_ronda),
    threshold: numberText(config.umbral_aprobacion),
  };
}

export function matchFromForm(form: MatchForm): unknown {
  return {
    pares: form.pairs.map((pair) => {
      const emoji = pair.emoji === undefined ? undefined : optionalText(pair.emoji);
      return {
        concepto: pair.concept.trim(),
        dato: pair.fact.trim(),
        ...(emoji === undefined ? {} : { emoji }),
      };
    }),
    pares_por_ronda: requiredNumber(form.perRound),
    rondas: requiredNumber(form.rounds),
    segundos_por_ronda: requiredNumber(form.seconds),
    umbral_aprobacion: requiredNumber(form.threshold),
  };
}

export interface PairsNeeded {
  /** Pares por ronda × rondas; `null` si alguno de los dos no es un número válido. */
  needed: number | null;
  have: number;
  enough: boolean;
}

/** Cuántos pares hacen falta frente a los que hay, con los números válidos del formulario. */
export function pairsNeeded(form: MatchForm): PairsNeeded {
  const perRound = parseDecimal(form.perRound);
  const rounds = parseDecimal(form.rounds);
  const needed =
    perRound !== undefined &&
    rounds !== undefined &&
    Number.isInteger(perRound) &&
    Number.isInteger(rounds) &&
    perRound > 0 &&
    rounds > 0
      ? perRound * rounds
      : null;
  const have = form.pairs.length;
  return { needed, have, enough: needed === null || have >= needed };
}
