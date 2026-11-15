import type { GameResult } from '@gns/shared';
import { useEffect, useRef } from 'react';

import { Icon } from '@/shared/ui';

import type { BestAttempt } from '../model/challenge';
import styles from './challenge.module.css';

export function BestLine({ best }: { best: BestAttempt | null }) {
  return best ? (
    <p className={styles.best}>
      Tu mejor intento: <b>{`${best.score}%`}</b> · {`${best.points} pts`}
    </p>
  ) : null;
}

/** Antes de jugar: el nombre del juego, sus reglas, el umbral de aprobación y el mejor intento. */
export function GameLobby({
  kicker,
  name,
  intro,
  rules,
  best,
  onStart,
}: {
  kicker: string;
  name: string;
  intro: string;
  rules: string[];
  best: BestAttempt | null;
  onStart: () => void;
}) {
  return (
    <div className={styles.lobby}>
      <div className={styles.logo}>
        <span>{kicker}</span>
        <b className={name.length > 8 ? styles.logoLong : undefined}>{name}</b>
      </div>
      <p className={styles.sub}>{intro}</p>
      <ul className={styles.rules}>
        {rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <BestLine best={best} />
      <button type="button" className={styles.play} onClick={onStart}>
        {best ? 'Intentar de nuevo' : 'Jugar'}
      </button>
    </div>
  );
}

export function GameBusy({ children }: { children: string }) {
  return (
    <div className={styles.busy}>
      <span aria-busy="true">{children}</span>
    </div>
  );
}

/** Final de la partida: porcentaje, puntos, si aprobó según el umbral y el mejor resultado. */
export function GameFinal({
  final,
  best,
  passedTitle,
  threshold,
  subject,
  onStart,
}: {
  final: GameResult;
  best: BestAttempt | null;
  passedTitle: string;
  threshold: number;
  /** Quién pide el porcentaje: «este módulo» o «esta actividad». */
  subject: string;
  onStart: () => void;
}) {
  const retryRef = useRef<HTMLButtonElement>(null);

  // El panel final aparece al terminar la partida: el foco pasa a «Intentar de nuevo».
  useEffect(() => {
    retryRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className={styles.lobby}>
      {final.passed ? (
        <Icon name="medalla" size={44} fill="solid" className={styles.medal} />
      ) : null}
      <h3 className={styles.finalTitle}>
        {final.passed ? passedTitle : 'Aún no alcanzas el porcentaje'}
      </h3>
      <p className={styles.total}>
        <b>{`${final.score}%`}</b>
        <small>{`${final.points} puntos`}</small>
      </p>
      <p className={styles.sub}>
        {final.passed
          ? `Superaste el ${threshold}% que pide ${subject}.`
          : `${subject.charAt(0).toUpperCase()}${subject.slice(1)} pide ${threshold}%. Puedes volver a intentarlo cuantas veces quieras.`}
      </p>
      <BestLine best={best} />
      <button ref={retryRef} type="button" className={styles.play} onClick={onStart}>
        Intentar de nuevo
      </button>
    </div>
  );
}

/** La API ya no tiene la partida (se reinició en otra pestaña o quedó obsoleta). */
export function GameLost({ best, onStart }: { best: BestAttempt | null; onStart: () => void }) {
  return (
    <div className={styles.lobby}>
      <h3 className={styles.finalTitle}>Esta partida ya no está disponible</h3>
      <p className={styles.sub}>
        Se reinició en otra pestaña o pasó demasiado tiempo sin respuesta. Tus intentos anteriores
        se conservan: puedes empezar una partida nueva.
      </p>
      <BestLine best={best} />
      <button type="button" className={styles.play} onClick={onStart}>
        Empezar de nuevo
      </button>
    </div>
  );
}

/** Fallo de conexión en medio de la partida: se conserva la pantalla y se ofrece reintentar. */
export function GameError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.lobby} role="alert">
      <h3 className={styles.finalTitle}>No pudimos continuar</h3>
      <p className={styles.sub}>{message}</p>
      <button type="button" className={styles.play} onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}
