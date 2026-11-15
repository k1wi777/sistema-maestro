'use client';

import type { TeacherActivity } from '@gns/shared';
import { useEffect, type CSSProperties } from 'react';

import { Button, Icon, isOpenStrokeIcon, Notice, type IconName } from '@/shared/ui';

import { useWheelStamp } from '../hooks/use-wheel-stamp';
import { emojiIcon } from '../model/emoji-icons';
import { wheelSegments, type WheelSegment } from '../model/wheel';
import challenge from './challenge.module.css';
import styles from './wheel-passport.module.css';

type WheelActivity = Extract<TeacherActivity, { type: 'ruleta_pasaporte' }>;
type Card = WheelActivity['config']['tarjetas'][number];

/** Duración del giro; con movimiento reducido la tarjeta aparece al instante. */
const SPIN_MS = 3200;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function wheelBackground(segments: WheelSegment[]): string {
  const stops = segments.map(
    (segment) => `var(--game-${segment.color}-top) ${segment.start}deg ${segment.end}deg`,
  );
  return `conic-gradient(${stops.join(', ')})`;
}

/** Icono de una tarjeta: de trazo por defecto y, solo si es un premio y se puede, con relleno suave. */
function CardIcon({ name, size, won }: { name: IconName; size: number; won?: boolean }) {
  if (won && !isOpenStrokeIcon(name)) {
    return <Icon name={name} size={size} fill="tone" />;
  }
  return <Icon name={name} size={size} />;
}

function CardView({
  card,
  question,
  chosen,
  correctIndex,
  disabled,
  kicker,
  onChoose,
}: {
  card: Card;
  question: boolean;
  chosen: number | null;
  correctIndex: number | null;
  disabled: boolean;
  kicker: string;
  onChoose: (index: number) => void;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardIcon}>
          <Icon name={emojiIcon(card.emoji)} size={30} />
        </span>
        <div>
          <span className={styles.kicker}>{kicker}</span>
          <h4 className={styles.cardTitle}>{card.titulo}</h4>
        </div>
      </div>
      <p className={styles.fact}>{card.dato}</p>
      <ul className={styles.facts}>
        {card.hechos.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      {card.enlace ? (
        <a className={styles.link} href={card.enlace.url} target="_blank" rel="noopener noreferrer">
          {card.enlace.texto}
          <Icon name="externo" size={14} />
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      ) : null}
      {question ? (
        <div className={styles.question}>
          <b>{`Gana el sello: ${card.pregunta.enunciado}`}</b>
          <div className={styles.options}>
            {card.pregunta.opciones.map((option, index) => {
              const isCorrect = correctIndex === index;
              const isWrong = correctIndex !== null && chosen === index && !isCorrect;
              return (
                <button
                  key={option}
                  type="button"
                  className={`${styles.option} ${isCorrect ? styles.optionOk : ''} ${
                    isWrong ? styles.optionBad : ''
                  }`}
                  disabled={disabled}
                  aria-pressed={chosen === index && correctIndex === null ? true : undefined}
                  onClick={() => onChoose(index)}
                >
                  {option}
                  {isCorrect ? <span className="sr-only"> (respuesta correcta)</span> : null}
                  {isWrong ? <span className="sr-only"> (tu respuesta)</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
  const segments = wheelSegments(cards);
  const busy = state.phase === 'spinning' || state.phase === 'card' || state.phase === 'submitting';
  const complete = cards.length > 0 && cards.every((card) => state.stamps.includes(card.clave));
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

  const wheelStyle: CSSProperties = {
    background: wheelBackground(segments),
    transform: `rotate(${state.rotation}deg)`,
  };

  return (
    <div className={styles.layout}>
      <div className={`${challenge.game} ${styles.wheelPanel}`}>
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
              <CardView
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

        <div className={styles.passport}>
          <div className={styles.passportHead}>
            <b>Mi pasaporte</b>
            <span
              className={styles.count}
            >{`${state.stamps.length} de ${cards.length} sellos`}</span>
            {complete ? (
              <span className={styles.badge}>
                <Icon name="medalla" size={16} fill="solid" />
                {insignia}
              </span>
            ) : null}
          </div>
          <ul className={styles.stamps}>
            {cards.map((card) => {
              const won = state.stamps.includes(card.clave);
              return (
                <li key={card.clave}>
                  {won ? (
                    <button
                      type="button"
                      className={`${styles.stamp} ${styles.stampOn}`}
                      aria-label={`${card.titulo_corto} · sello ganado`}
                      aria-pressed={state.review === card.clave}
                      disabled={busy}
                      onClick={() => game.review(card.clave)}
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
      </div>
    </div>
  );
}
