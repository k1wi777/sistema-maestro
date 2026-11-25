import type { Ref } from 'react';

import { Icon } from '@/shared/ui';

import styles from './statement-card.module.css';

/** Tarjeta de la afirmación con el tiempo y los botones Mito y Verdad (en la vista previa, deshabilitados). */
export function StatementCard({
  text,
  remaining,
  graded,
  chosen = null,
  open,
  mythRef,
  onChoose,
}: {
  text: string;
  /** Segundos que quedan (o que dura cada afirmación, en la vista previa). */
  remaining: number;
  /** Resultado de la respuesta: pinta el borde de la tarjeta. */
  graded: 'ok' | 'bad' | null;
  /** Lo que respondió el docente (`true` verdad, `false` mito): la tarjeta se inclina hacia ese lado. */
  chosen?: boolean | null;
  /** Se puede responder ahora. */
  open: boolean;
  mythRef?: Ref<HTMLButtonElement>;
  onChoose?: (value: boolean) => void;
}) {
  return (
    <>
      <div
        className={`${styles.card} ${graded === 'ok' ? styles.cardOk : ''} ${
          graded === 'bad' ? styles.cardBad : ''
        } ${graded && chosen === true ? styles.leanRight : ''} ${
          graded && chosen === false ? styles.leanLeft : ''
        }`}
      >
        <span className={styles.kind}>¿Verdad o mito?</span>
        <p>{text}</p>
        <span
          className={styles.seconds}
          role="timer"
          aria-label={`Quedan ${Math.ceil(remaining)} segundos`}
        >
          <span aria-hidden="true">{`${Math.ceil(remaining)} s`}</span>
        </span>
      </div>
      <div className={styles.choices}>
        <button
          ref={mythRef}
          type="button"
          className={`${styles.choice} ${styles.myth}`}
          disabled={!open}
          onClick={() => onChoose?.(false)}
        >
          <Icon name="x" size={22} />
          Mito
        </button>
        <button
          type="button"
          className={`${styles.choice} ${styles.truth}`}
          disabled={!open}
          onClick={() => onChoose?.(true)}
        >
          <Icon name="check" size={22} />
          Verdad
        </button>
      </div>
    </>
  );
}
