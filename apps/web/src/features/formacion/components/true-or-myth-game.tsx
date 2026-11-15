'use client';

import type { TeacherActivity } from '@gns/shared';
import { useEffect, useRef, type KeyboardEvent } from 'react';

import { Icon } from '@/shared/ui';

import { useCountdown } from '../hooks/use-countdown';
import { useTrueOrMythGame } from '../hooks/use-true-or-myth-game';
import { bestOf } from '../model/best-attempt';
import {
  trueOrMythAnnouncement,
  trueOrMythKey,
  type Statement,
  type TrueOrMythState,
} from '../model/true-or-myth';
import challenge from './challenge.module.css';
import { GameBusy, GameError, GameFinal, GameLobby, GameLost } from './game-panels';
import styles from './true-or-myth-game.module.css';

type MythActivity = Extract<TeacherActivity, { type: 'verdad_o_mito' }>;

interface StatementHandlers {
  choose: (value: boolean) => void;
  timeout: () => void;
  advance: () => void;
  retry: () => void;
}

function Hearts({ lives, max }: { lives: number; max: number }) {
  return (
    <span
      className={styles.hearts}
      role="img"
      aria-label={lives === 1 ? '1 vida' : `${lives} vidas`}
    >
      {Array.from({ length: max }, (_, index) => (
        <Icon
          key={index}
          name="corazon"
          size={18}
          fill={index < lives ? 'solid' : 'none'}
          className={index < lives ? styles.heartOn : styles.heartOff}
        />
      ))}
    </span>
  );
}

function Feedback({ state, onAdvance }: { state: TrueOrMythState; onAdvance: () => void }) {
  const nextRef = useRef<HTMLButtonElement>(null);
  const { result } = state;

  useEffect(() => {
    nextRef.current?.focus();
  }, []);

  if (!result) {
    return null;
  }
  const title = result.timedOut
    ? 'Se acabó el tiempo'
    : result.correct
      ? '¡Correcto!'
      : 'Incorrecto';
  return (
    <div className={result.correct ? challenge.feedbackOk : challenge.feedbackBad}>
      <div className={challenge.feedbackHead}>
        <b>{title}</b>
        <span className={challenge.gain}>
          <Icon name="llama" size={15} fill="solid" />
          {`+${result.pointsGained} pts · racha de ${result.streak}`}
        </span>
      </div>
      <p className={challenge.feedbackText}>
        <b>{result.isTrue ? 'Era verdad. ' : 'Era mito. '}</b>
        {result.explanation}
        {result.lives <= 0 ? ' Te quedaste sin vidas.' : ''}
      </p>
      <button ref={nextRef} type="button" className={challenge.next} onClick={onAdvance}>
        {result.finished ? 'Ver resultado' : 'Siguiente'}
      </button>
    </div>
  );
}

/** Una afirmación: marcador, vidas, tiempo y botones. Se monta de nuevo en cada afirmación. */
function StatementView({
  state,
  statement,
  maxLives,
  handlers,
}: {
  state: TrueOrMythState;
  statement: Statement;
  maxLives: number;
  handlers: StatementHandlers;
}) {
  const mythRef = useRef<HTMLButtonElement>(null);
  const open = state.phase === 'statement';
  const remaining = useCountdown(statement.seconds, open, handlers.timeout);
  const percent = statement.seconds > 0 ? Math.min(100, (remaining / statement.seconds) * 100) : 0;
  const graded = state.phase === 'answered' ? state.result : null;

  useEffect(() => {
    mythRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className={challenge.questionScreen}>
      <div className={challenge.top}>
        <span className={challenge.counter}>{`${statement.position} / ${state.total}`}</span>
        <Hearts lives={state.lives} max={Math.max(maxLives, state.lives)} />
        <span className={challenge.points} aria-label={`${state.points} puntos`}>
          {`${state.points} pts`}
        </span>
        <span className={challenge.streak} aria-label={`Racha de ${state.streak}`}>
          <Icon name="llama" size={15} fill="solid" />
          {state.streak}
        </span>
      </div>
      <div className={challenge.timeBar} aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      <div
        className={`${styles.card} ${graded ? (graded.correct ? styles.cardOk : styles.cardBad) : ''}`}
      >
        <span className={styles.kind}>¿Verdad o mito?</span>
        <p>{statement.text}</p>
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
          onClick={() => handlers.choose(false)}
        >
          <Icon name="x" size={22} />
          Mito
        </button>
        <button
          type="button"
          className={`${styles.choice} ${styles.truth}`}
          disabled={!open}
          onClick={() => handlers.choose(true)}
        >
          <Icon name="check" size={22} />
          Verdad
        </button>
      </div>
      {open ? (
        <p className={styles.keys}>También puedes usar las flechas: ← mito · verdad →</p>
      ) : null}
      {state.phase === 'answered' ? <Feedback state={state} onAdvance={handlers.advance} /> : null}
      {state.phase === 'error' ? (
        <div className={challenge.feedbackBad} role="alert">
          <div className={challenge.feedbackHead}>
            <b>No pudimos continuar</b>
          </div>
          <p className={challenge.feedbackText}>{state.errorMessage}</p>
          <button type="button" className={challenge.next} onClick={handlers.retry}>
            Reintentar
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * ¿Verdad o mito? dentro de la actividad. Pinta lo que dice `useTrueOrMythGame` y la API califica:
 * el navegador nunca conoce si una afirmación es verdad antes de responder. Con teclado: Tab y
 * Enter sobre botones reales, ← Mito, → Verdad y Enter para «Siguiente».
 */
export function TrueOrMythGame({
  activity,
  onProgress,
}: {
  activity: MythActivity;
  onProgress: () => void;
}) {
  const { config, progress } = activity;
  const game = useTrueOrMythGame({ activityId: activity.id, best: bestOf(progress), onProgress });
  const { state } = game;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    // Enter sobre un botón o enlace ya lo activa el navegador: no se repite.
    if (event.key === 'Enter' && target.closest('button, a')) {
      return;
    }
    const action = trueOrMythKey({
      key: event.key,
      phase: state.phase,
      inField: target.closest('input, textarea, select, [contenteditable="true"]') !== null,
      modified: event.ctrlKey || event.metaKey || event.altKey,
    });
    if (!action) {
      return;
    }
    event.preventDefault();
    if (action.type === 'choose') {
      game.choose(action.value);
    } else {
      game.advance();
    }
  }

  const handlers: StatementHandlers = {
    choose: game.choose,
    timeout: game.timeout,
    advance: game.advance,
    retry: game.retry,
  };

  let body;
  if (state.phase === 'starting' || state.phase === 'loadingNext') {
    body = <GameBusy>Preparando la afirmación…</GameBusy>;
  } else if (
    state.statement &&
    (state.phase === 'statement' ||
      state.phase === 'submitting' ||
      state.phase === 'answered' ||
      state.phase === 'error')
  ) {
    body = (
      <StatementView
        key={state.statement.position}
        state={state}
        statement={state.statement}
        maxLives={config.vidas}
        handlers={handlers}
      />
    );
  } else if (state.phase === 'finished' && state.final) {
    body = (
      <GameFinal
        final={state.final}
        best={state.best}
        passedTitle={`¡Aprobaste ${activity.title}!`}
        threshold={config.umbral_aprobacion}
        subject="esta actividad"
        onStart={game.start}
      />
    );
  } else if (state.phase === 'lost') {
    body = <GameLost best={state.best} onStart={game.start} />;
  } else if (state.phase === 'error') {
    body = <GameError message={state.errorMessage ?? ''} onRetry={game.retry} />;
  } else {
    body = (
      <GameLobby
        kicker="Actividad"
        name="¿Verdad o mito?"
        intro="Decide si cada afirmación es verdad o mito antes de que se acabe el tiempo. Cada error cuesta una vida."
        rules={[
          config.por_partida === 1 ? '1 afirmación' : `${config.por_partida} afirmaciones`,
          config.vidas === 1 ? '1 vida' : `${config.vidas} vidas`,
          `${config.segundos_por_afirmacion} s cada una`,
          `Apruebas con ${config.umbral_aprobacion}%`,
        ]}
        best={state.best}
        onStart={game.start}
      />
    );
  }

  return (
    <div
      className={challenge.game}
      tabIndex={-1}
      role="group"
      aria-label={`¿Verdad o mito?: ${activity.title}`}
      onKeyDown={onKeyDown}
    >
      {body}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {trueOrMythAnnouncement(state)}
      </div>
    </div>
  );
}
