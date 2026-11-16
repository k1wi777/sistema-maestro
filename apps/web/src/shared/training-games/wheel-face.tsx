import type { CSSProperties } from 'react';

import { emojiIcon, Icon } from '@/shared/ui';

import { wheelSegments, type WheelSegment } from './wheel';
import styles from './wheel.module.css';

/** Lo que la cara de la ruleta pinta de cada tarjeta. */
export interface WheelFaceCard {
  clave: string;
  emoji: string;
}

function wheelBackground(segments: WheelSegment[]): string {
  const stops = segments.map(
    (segment) => `var(--game-${segment.color}-top) ${segment.start}deg ${segment.end}deg`,
  );
  return `conic-gradient(${stops.join(', ')})`;
}

/** Cara de la ruleta: segmentos de colores con el icono de cada tarjeta, puntero y centro. */
export function WheelFace({
  cards,
  rotation = 0,
}: {
  cards: readonly WheelFaceCard[];
  /** Giro acumulado en grados; sin él, la ruleta no gira (vista previa). */
  rotation?: number;
}) {
  const segments = wheelSegments(cards);
  const wheelStyle: CSSProperties = {
    background: wheelBackground(segments),
    transform: `rotate(${rotation}deg)`,
  };
  return (
    <div className={styles.wheelWrap}>
      <span className={styles.pointer} aria-hidden="true" />
      <div
        className={styles.wheel}
        style={wheelStyle}
        role="img"
        aria-label={`Ruleta con ${cards.length} beneficios`}
      >
        {segments.map((segment, index) => (
          <span
            key={segment.key}
            className={styles.segmentIcon}
            data-color={segment.color}
            style={{ '--angle': `${segment.center}deg` } as CSSProperties}
          >
            <Icon name={emojiIcon(cards[index]?.emoji)} size={24} />
          </span>
        ))}
      </div>
      <span className={styles.hub} aria-hidden="true">
        GNS
      </span>
    </div>
  );
}
