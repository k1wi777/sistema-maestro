'use client';

import type { TeacherActivity } from '@gns/shared';
import { useEffect } from 'react';

import { Button, Notice } from '@/shared/ui';
import { gameFrame as challenge, Passport, WheelCard, WheelFace } from '@/shared/training-games';

import { useWheelStamp } from '../hooks/use-wheel-stamp';
import styles from './wheel-passport.module.css';

type WheelActivity = Extract<TeacherActivity, { type: 'ruleta_pasaporte' }>;

/** Duración del giro; con movimiento reducido la tarjeta aparece al instante. */
const SPIN_MS = 3200;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Ruleta y pasaporte de sellos: la ruleta elige una tarjeta sin sello al azar y su pregunta se
 * responde a la API, que califica y concede el sello. El navegador no conoce la respuesta correcta.
 */
export function WheelPassport({
  activity,
  onProgress,
}: {
  activity: WheelActivity;
  onProgress: () => void;
}) {
  const { tarjetas: cards, insignia } = activity.config;
  const game = useWheelStamp({
    activityId: activity.id,
    stamps: activity.progress.stamps,
    onProgress,
  });
  const { state } = game;
  const busy = state.phase === 'spinning' || state.phase === 'card' || state.phase === 'submitting';
  const { spun } = game;

  useEffect(() => {
    if (state.phase !== 'spinning') {
      return;
    }
    const timer = setTimeout(spun, prefersReducedMotion() ? 0 : SPIN_MS);
    return () => clearTimeout(timer);
  }, [state.phase, spun]);

  const reviewed = state.review ? cards.find((card) => card.clave === state.review) : undefined;
  const drawn = state.card ? cards[state.card.index] : undefined;
  const shown = reviewed ?? (state.phase === 'spinning' ? undefined : drawn);
  const result = state.result;
  const answeredWithSeal = result?.correct === true && !state.alreadyStamped;

  let message: { tone: 'ok' | 'bad'; text: string } | null = null;
  if (state.phase === 'answered' && result && drawn) {
    if (result.correct) {
      message = {
        tone: 'ok',
        text: answeredWithSeal
          ? '¡Sello ganado! Gira otra vez para descubrir más.'
          : 'Ya tenías este sello. Gira otra vez para descubrir más.',
      };
    } else {
      message = {
        tone: 'bad',
        text: `Esta vez no: la respuesta era «${drawn.pregunta.opciones[result.correctIndex] ?? ''}». Gira otra vez.`,
      };
    }
  }

  return (
    <div className={styles.layout}>
      <div className={`${challenge.game} ${styles.wheelPanel}`}>
        <WheelFace cards={cards} rotation={state.rotation} />
        <button
          type="button"
          className={challenge.play}
          disabled={busy}
          onClick={() => game.spin(cards)}
        >
          {state.phase === 'spinning' ? 'Girando…' : '¡Girar!'}
        </button>
      </div>

      <div className={styles.side}>
        <div aria-live="polite">
          {shown ? (
            <>
              <WheelCard
                card={shown}
                question={!reviewed}
                chosen={state.chosen}
                correctIndex={result && !reviewed ? result.correctIndex : null}
                disabled={state.phase !== 'card'}
                kicker={reviewed ? 'Sello ganado' : '¡Descubriste un beneficio!'}
                onChoose={game.choose}
              />
              {message ? (
                <p className={message.tone === 'ok' ? styles.msgOk : styles.msgBad}>
                  {message.text}
                </p>
              ) : null}
            </>
          ) : (
            <p className={styles.hint}>
              {state.phase === 'spinning'
                ? 'La ruleta está girando…'
                : 'Gira la ruleta para descubrir un beneficio. Responde su pregunta para ganar el sello.'}
            </p>
          )}
        </div>
        {state.phase === 'error' ? (
          <Notice tone="error" title="No pudimos guardar tu respuesta">
            <p>{state.errorMessage}</p>
            <p>
              <Button variant="outline" size="sm" onClick={game.retry}>
                Reintentar
              </Button>
            </p>
            <p>También puedes girar de nuevo, pero esta tarjeta no dará sello.</p>
          </Notice>
        ) : null}
        {reviewed ? (
          <button type="button" className={styles.close} onClick={game.closeReview}>
            Cerrar tarjeta
          </button>
        ) : null}

        <Passport
          cards={cards}
          stamps={state.stamps}
          badge={insignia}
          reviewing={state.review}
          busy={busy}
          onReview={game.review}
        />
      </div>
    </div>
  );
}
