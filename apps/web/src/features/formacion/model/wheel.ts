import type { WheelStampResult } from '@gns/shared';

/** Lo que la ruleta necesita de cada tarjeta para girar y elegir; el resto lo pinta el componente. */
export interface WheelCardRef {
  clave: string;
}

export type WheelColor = 'red' | 'blue' | 'yellow' | 'green';

const COLORS: readonly WheelColor[] = ['red', 'blue', 'yellow', 'green'];

export interface WheelSegment {
  key: string;
  /** Ángulos en grados, en sentido horario desde el puntero (arriba). */
  start: number;
  end: number;
  center: number;
  color: WheelColor;
}

/**
 * Segmentos de la ruleta: uno por tarjeta, del mismo tamaño, con cuatro colores en rotación. Si el
 * último quedara del color del primero (la ruleta es circular), se cambia por otro color distinto
 * de sus dos vecinos.
 */
export function wheelSegments(cards: readonly WheelCardRef[]): WheelSegment[] {
  const count = cards.length;
  const size = count === 0 ? 0 : 360 / count;
  const segments = cards.map((card, index): WheelSegment => ({
    key: card.clave,
    start: index * size,
    end: (index + 1) * size,
    center: (index + 0.5) * size,
    color: COLORS[index % COLORS.length] ?? 'red',
  }));
  const first = segments[0];
  const last = segments[segments.length - 1];
  const before = segments[segments.length - 2];
  if (segments.length > 2 && first && last && before && last.color === first.color) {
    last.color = COLORS.find((c) => c !== first.color && c !== before.color) ?? last.color;
  }
  return segments;
}

/**
 * Índice (en `cards`) de la tarjeta que sale al girar: al azar entre las que aún no tienen sello o,
 * con el pasaporte completo, entre todas. `random` devuelve un número en [0, 1).
 */
export function pickCard(
  cards: readonly WheelCardRef[],
  stamps: readonly string[],
  random: () => number,
): number {
  if (cards.length === 0) {
    return -1;
  }
  const all = cards.map((_, index) => index);
  const pending = all.filter((index) => !stamps.includes(cards[index]?.clave ?? ''));
  const pool = pending.length > 0 ? pending : all;
  const pick = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[pick] ?? 0;
}

const FULL_TURNS_MIN = 4;
const FULL_TURNS_SPREAD = 3;
/** Parte del segmento (repartida a ambos lados del centro) en la que puede detenerse el puntero. */
const STOP_SPREAD = 0.6;

/**
 * Giro total acumulado (en grados) que deja bajo el puntero la tarjeta `index`: siempre mayor que
 * `current`, con varias vueltas completas y un punto de parada al azar dentro del segmento.
 */
export function spinRotation(
  current: number,
  index: number,
  count: number,
  random: () => number,
): number {
  const size = 360 / count;
  const jitter = (random() - 0.5) * size * STOP_SPREAD;
  const wanted = (((360 - (index + 0.5) * size - jitter) % 360) + 360) % 360;
  const forward = (((wanted - (current % 360)) % 360) + 360) % 360;
  const turns = FULL_TURNS_MIN + Math.floor(random() * FULL_TURNS_SPREAD);
  return current + turns * 360 + forward;
}

export type WheelPhase = 'idle' | 'spinning' | 'card' | 'submitting' | 'answered' | 'error';

export interface WheelState {
  phase: WheelPhase;
  rotation: number;
  /** Tarjeta que salió (índice y clave) y su respuesta en vuelo. */
  card: { index: number; key: string } | null;
  chosen: number | null;
  result: WheelStampResult | null;
  /** Sellos conocidos: los del avance y, tras cada respuesta, los que devolvió la API. */
  stamps: string[];
  /** El acierto fue sobre una tarjeta que ya tenía sello (la API no suma). */
  alreadyStamped: boolean;
  /** Sello ganado que se revisa (sin pregunta). */
  review: string | null;
  errorMessage: string | null;
  /** Cuenta de envíos: el efecto del hook manda cada uno una sola vez (modo estricto). */
  seq: number;
}

export type WheelEvent =
  | { type: 'spin'; index: number; key: string; rotation: number }
  | { type: 'spun' }
  | { type: 'choose'; optionIndex: number }
  | { type: 'result'; result: WheelStampResult }
  | { type: 'failed'; message: string }
  | { type: 'retry' }
  | { type: 'review'; key: string }
  | { type: 'closeReview' };

export function initialWheelState(stamps: string[]): WheelState {
  return {
    phase: 'idle',
    rotation: 0,
    card: null,
    chosen: null,
    result: null,
    stamps,
    alreadyStamped: false,
    review: null,
    errorMessage: null,
    seq: 0,
  };
}

const CAN_SPIN: readonly WheelPhase[] = ['idle', 'answered', 'error'];

/**
 * Máquina de la ruleta: `idle → spinning → card → submitting → answered`, más `error` si falla la
 * red (se puede reintentar o girar otra vez sin sello). Una tarjeta se responde una sola vez: toda
 * elección fuera de `card` se ignora. Solo son transiciones: si acertó lo dice la API.
 */
export function wheelReducer(state: WheelState, event: WheelEvent): WheelState {
  switch (event.type) {
    case 'spin': {
      if (!CAN_SPIN.includes(state.phase)) {
        return state;
      }
      return {
        ...state,
        phase: 'spinning',
        rotation: event.rotation,
        card: { index: event.index, key: event.key },
        chosen: null,
        result: null,
        alreadyStamped: false,
        review: null,
        errorMessage: null,
      };
    }
    case 'spun':
      return state.phase === 'spinning' ? { ...state, phase: 'card' } : state;
    case 'choose': {
      if (state.phase !== 'card' || !state.card) {
        return state;
      }
      return {
        ...state,
        phase: 'submitting',
        chosen: event.optionIndex,
        alreadyStamped: state.stamps.includes(state.card.key),
        seq: state.seq + 1,
      };
    }
    case 'result': {
      if (state.phase !== 'submitting') {
        return state;
      }
      return { ...state, phase: 'answered', result: event.result, stamps: event.result.stamps };
    }
    case 'failed':
      return state.phase === 'submitting'
        ? { ...state, phase: 'error', errorMessage: event.message }
        : state;
    case 'retry': {
      if (state.phase !== 'error' || state.chosen === null || !state.card) {
        return state;
      }
      return { ...state, phase: 'submitting', errorMessage: null, seq: state.seq + 1 };
    }
    case 'review': {
      if (!CAN_SPIN.includes(state.phase) || !state.stamps.includes(event.key)) {
        return state;
      }
      return { ...state, review: event.key };
    }
    case 'closeReview':
      return state.review === null ? state : { ...state, review: null };
  }
}
