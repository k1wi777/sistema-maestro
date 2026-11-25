import styles from './game-frame.module.css';

/**
 * «+N» que sube y se desvanece junto al marcador al acertar. Es decorativo: el puntaje se anuncia
 * por texto en el marcador y en la retroalimentación. Con movimiento reducido no se pinta.
 */
export function FloatingGain({ amount }: { amount: number }) {
  if (amount <= 0) {
    return null;
  }
  return (
    <span className={styles.floatGain} aria-hidden="true">
      {`+${amount}`}
    </span>
  );
}
