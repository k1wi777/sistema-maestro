import type { WheelPassportConfig } from '@gns/shared';

/**
 * Tarjeta de la ruleta como la ve quien la pinta: la respuesta correcta nunca llega al docente, y
 * la vista previa de coordinación tampoco la necesita.
 */
export type WheelCardConfig = Omit<WheelPassportConfig['tarjetas'][number], 'pregunta'> & {
  pregunta: Omit<WheelPassportConfig['tarjetas'][number]['pregunta'], 'correcta'>;
};

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
