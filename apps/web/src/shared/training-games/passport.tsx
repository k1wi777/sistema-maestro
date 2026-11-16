import { emojiIcon, Icon, isOpenStrokeIcon, type IconName } from '@/shared/ui';

import styles from './wheel.module.css';

/** Icono de una tarjeta: de trazo por defecto y, solo si es un premio y se puede, con relleno suave. */
function CardIcon({ name, size, won }: { name: IconName; size: number; won?: boolean }) {
  if (won && !isOpenStrokeIcon(name)) {
    return <Icon name={name} size={size} fill="tone" />;
  }
  return <Icon name={name} size={size} />;
}

export interface PassportCard {
  clave: string;
  titulo_corto: string;
  emoji: string;
}

/** Pasaporte de sellos: los ganados se pueden revisar (si hay manejador) y el resto está por descubrir. */
export function Passport({
  cards,
  stamps,
  badge,
  reviewing = null,
  busy = false,
  onReview,
}: {
  cards: readonly PassportCard[];
  stamps: readonly string[];
  badge: string;
  /** Clave del sello que se revisa. */
  reviewing?: string | null;
  busy?: boolean;
  onReview?: (key: string) => void;
}) {
  const complete = cards.length > 0 && cards.every((card) => stamps.includes(card.clave));
  return (
    <div className={styles.passport}>
      <div className={styles.passportHead}>
        <b>Mi pasaporte</b>
        <span className={styles.count}>{`${stamps.length} de ${cards.length} sellos`}</span>
        {complete ? (
          <span className={styles.badge}>
            <Icon name="medalla" size={16} fill="solid" />
            {badge}
          </span>
        ) : null}
      </div>
      <ul className={styles.stamps}>
        {cards.map((card) => {
          const won = stamps.includes(card.clave);
          return (
            <li key={card.clave}>
              {won ? (
                <button
                  type="button"
                  className={`${styles.stamp} ${styles.stampOn}`}
                  aria-label={`${card.titulo_corto} · sello ganado`}
                  aria-pressed={reviewing === card.clave}
                  disabled={busy || !onReview}
                  onClick={() => onReview?.(card.clave)}
                >
                  <span>
                    <CardIcon name={emojiIcon(card.emoji)} size={20} won />
                  </span>
                  <small>{card.titulo_corto}</small>
                </button>
              ) : (
                <div className={styles.stamp}>
                  <span aria-hidden="true">?</span>
                  <small>
                    {card.titulo_corto}
                    <span className="sr-only"> · por descubrir</span>
                  </small>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
