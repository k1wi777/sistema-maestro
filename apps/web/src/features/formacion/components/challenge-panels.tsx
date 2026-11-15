import type { TeacherModule } from '@gns/shared';

import { Icon } from '@/shared/ui';

import type { BestAttempt, ChallengeState } from '../model/challenge';
import styles from './challenge.module.css';

export function BestLine({ best }: { best: BestAttempt | null }) {
  return best ? (
    <p className={styles.best}>
      Tu mejor intento: <b>{`${best.score}%`}</b> · {`${best.points} pts`}
    </p>
  ) : null;
}

/** Antes de jugar: cuántas preguntas, el umbral de aprobación y el mejor intento. */
export function ChallengeLobby({
  module,
  best,
  onStart,
}: {
  module: TeacherModule;
  best: BestAttempt | null;
  onStart: () => void;
}) {
  const { questionCount, approvalThreshold } = module.challenge;
  return (
    <div className={styles.lobby}>
      <div className={styles.logo}>
        <span>Desafío</span>
        <b>GNS</b>
      </div>
      <p className={styles.sub}>
        Responde con rapidez y constancia: cada acierto suma puntos y la racha los multiplica.
      </p>
      <ul className={styles.rules}>
        <li>{questionCount === 1 ? '1 pregunta' : `${questionCount} preguntas`}</li>
        <li>{`Apruebas con ${approvalThreshold}%`}</li>
      </ul>
      <BestLine best={best} />
      <button type="button" className={styles.play} onClick={onStart}>
        {best ? 'Intentar de nuevo' : 'Jugar'}
      </button>
    </div>
  );
}

export function ChallengeBusy({ children }: { children: string }) {
  return (
    <div className={styles.busy}>
      <span aria-busy="true">{children}</span>
    </div>
  );
}

/** Final de la partida: porcentaje, puntos, si aprobó según el umbral y el mejor resultado. */
export function ChallengeFinal({
  module,
  state,
  onStart,
}: {
  module: TeacherModule;
  state: ChallengeState;
  onStart: () => void;
}) {
  const { final, best } = state;
  if (!final) {
    return null;
  }
  const threshold = module.challenge.approvalThreshold;
  return (
    <div className={styles.lobby}>
      {final.passed ? (
        <Icon name="medalla" size={44} fill="solid" className={styles.medal} />
      ) : null}
      <h3 className={styles.finalTitle}>
        {final.passed ? '¡Aprobaste el Desafío GNS!' : 'Aún no alcanzas el porcentaje'}
      </h3>
      <p className={styles.total}>
        <b>{`${final.score}%`}</b>
        <small>{`${final.points} puntos`}</small>
      </p>
      <p className={styles.sub}>
        {final.passed
          ? `Superaste el ${threshold}% que pide este módulo.`
          : `Este módulo pide ${threshold}%. Puedes volver a intentarlo cuantas veces quieras.`}
      </p>
      <BestLine best={best} />
      <button type="button" className={styles.play} onClick={onStart}>
        Intentar de nuevo
      </button>
    </div>
  );
}

/** La API ya no tiene la partida (se reinició en otra pestaña o quedó obsoleta). */
export function ChallengeLost({
  best,
  onStart,
}: {
  best: BestAttempt | null;
  onStart: () => void;
}) {
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

/** Fallo de conexión en medio de la partida: se conserva la pregunta y se ofrece reintentar. */
export function ChallengeError({ message, onRetry }: { message: string; onRetry: () => void }) {
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
