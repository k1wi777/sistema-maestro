'use client';

import type { MatchRound, TeacherActivity } from '@gns/shared';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { Icon } from '@/shared/ui';

import { FloatingGain, gameFrame as challenge, MatchColumns } from '@/shared/training-games';

import { useCountdown } from '../hooks/use-countdown';
import { useMatchGame } from '../hooks/use-match-game';
import { bestOf } from '../model/best-attempt';
import { advanceDelayMs, matchAnnouncement, type MatchState } from '../model/match';
import { GameBusy, GameError, GameFinal, GameLobby, GameLost } from './game-panels';
import styles from './match-game.module.css';

type MatchActivity = Extract<TeacherActivity, { type: 'conecta' }>;

interface BoardHandlers {
  selectConcept: (token: string) => void;
  selectFact: (token: string) => void;
  timeout: () => void;
  advance: () => void;
  retry: () => void;
}

/** Botones que se pueden pulsar ahora: los conectados quedan fuera (`disabled`). */
const FOCUSABLE = 'button:not(:disabled):not([aria-disabled="true"])';

function RoundOver({
  state,
  round,
  onAdvance,
}: {
  state: MatchState;
  round: MatchRound;
  onAdvance: () => void;
}) {
  const [ready, setReady] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const { overBy } = state;

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), advanceDelayMs(overBy));
    return () => clearTimeout(timer);
  }, [overBy]);

  const enabled = ready && state.pending === null;
  useEffect(() => {
    if (enabled) {
      nextRef.current?.focus();
    }
  }, [enabled]);

  const complete = overBy === 'complete';
  const last = round.round === round.totalRounds;
  return (
    <div className={complete ? challenge.feedbackOk : challenge.feedbackBad}>
      <div className={challenge.feedbackHead}>
        <b>{complete ? '¡Ronda completa!' : 'Se acabó el tiempo'}</b>
        <span className={challenge.gain}>
          <Icon name="llama" size={15} fill="solid" />
          {`${state.points} pts · racha de ${state.streak}`}
        </span>
      </div>
      <p className={challenge.feedbackText}>
        {`${state.connectedConcepts.length} de ${round.concepts.length} parejas conectadas.`}
      </p>
      <button
        ref={nextRef}
        type="button"
        className={challenge.next}
        disabled={!enabled}
        onClick={onAdvance}
      >
        {last ? 'Ver resultado' : 'Siguiente ronda'}
      </button>
    </div>
  );
}

/** Una ronda: marcador, tiempo y las dos columnas. Se monta de nuevo en cada ronda. */
function MatchBoard({
  state,
  round,
  handlers,
}: {
  state: MatchState;
  round: MatchRound;
  handlers: BoardHandlers;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const open = state.phase === 'playing' || (state.phase === 'error' && state.overBy === null);
  const remaining = useCountdown(round.seconds, open, handlers.timeout);
  const percent = round.seconds > 0 ? Math.min(100, (remaining / round.seconds) * 100) : 0;
  const interactive = state.phase === 'playing' && state.pending === null;

  useEffect(() => {
    boardRef.current?.querySelector<HTMLButtonElement>(FOCUSABLE)?.focus({ preventScroll: true });
  }, []);

  // Al conectar, el botón que tenía el foco queda deshabilitado: el foco pasa al siguiente libre.
  useEffect(() => {
    if (state.notice === 'hit') {
      boardRef.current?.querySelector<HTMLButtonElement>(FOCUSABLE)?.focus({ preventScroll: true });
    }
  }, [state.notice, state.noticeSeq]);

  return (
    <div className={challenge.questionScreen} ref={boardRef}>
      <div className={challenge.top}>
        <span className={challenge.counter}>{`Ronda ${round.round} de ${round.totalRounds}`}</span>
        <span
          className={challenge.counter}
          role="timer"
          aria-label={`Quedan ${Math.ceil(remaining)} segundos`}
        >
          <span aria-hidden="true">{`${Math.ceil(remaining)} s`}</span>
        </span>
        <span className={challenge.points} aria-label={`${state.points} puntos`}>
          {`${state.points} pts`}
          <FloatingGain key={state.noticeSeq} amount={state.gain} />
        </span>
        <span className={challenge.streak} aria-label={`Racha de ${state.streak}`}>
          <Icon name="llama" size={15} fill="solid" />
          {state.streak}
        </span>
      </div>
      <div className={challenge.timeBar} aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.hint}>
        Toca un concepto y luego su dato, o al revés.
        <span className={styles.status} aria-hidden="true">
          {state.notice === 'miss' ? ' No es su pareja: inténtalo de nuevo.' : ''}
          {state.notice === 'hit' ? ' ¡Pareja conectada!' : ''}
        </span>
      </p>
      <MatchColumns
        concepts={round.concepts}
        facts={round.facts}
        connectedConcepts={state.connectedConcepts}
        connectedFacts={state.connectedFacts}
        selectedConcept={state.concept}
        selectedFact={state.fact}
        wrongConcept={state.lastMiss?.conceptToken ?? null}
        wrongFact={state.lastMiss?.factToken ?? null}
        interactive={interactive}
        onSelectConcept={handlers.selectConcept}
        onSelectFact={handlers.selectFact}
      />
      {state.phase === 'roundOver' ? (
        <RoundOver state={state} round={round} onAdvance={handlers.advance} />
      ) : null}
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
 * Conecta dentro de la actividad. Pinta lo que dice `useMatchGame` y la API califica: el navegador
 * nunca conoce la pareja correcta de un concepto. Se juega con teclado (Tab y Enter o Espacio sobre
 * botones reales; Esc limpia la selección).
 */
export function MatchGame({
  activity,
  onProgress,
}: {
  activity: MatchActivity;
  onProgress: () => void;
}) {
  const { config, progress } = activity;
  const game = useMatchGame({ activityId: activity.id, best: bestOf(progress), onProgress });
  const { state } = game;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      game.clearSelection();
    }
  }

  let body;
  if (state.phase === 'starting' || state.phase === 'loadingNext') {
    body = <GameBusy>Preparando la ronda…</GameBusy>;
  } else if (
    state.round &&
    (state.phase === 'playing' || state.phase === 'roundOver' || state.phase === 'error')
  ) {
    body = (
      <MatchBoard
        key={state.round.round}
        state={state}
        round={state.round}
        handlers={{
          selectConcept: game.selectConcept,
          selectFact: game.selectFact,
          timeout: game.timeout,
          advance: game.advance,
          retry: game.retry,
        }}
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
        name="Conecta"
        intro="Une cada concepto con su dato antes de que se acabe el tiempo."
        rules={[
          config.rondas === 1 ? '1 ronda' : `${config.rondas} rondas`,
          `${config.pares_por_ronda} parejas por ronda`,
          `${config.segundos_por_ronda} s por ronda`,
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
      aria-label={`Conecta: ${activity.title}`}
      onKeyDown={onKeyDown}
    >
      {body}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        <span key={state.noticeSeq}>{matchAnnouncement(state)}</span>
      </div>
    </div>
  );
}
