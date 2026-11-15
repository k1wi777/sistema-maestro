'use client';

import type { TeacherModule } from '@gns/shared';
import { useEffect, useRef, type KeyboardEvent } from 'react';

import { useChallenge } from '../hooks/use-challenge';
import type { BestAttempt, ChallengeState } from '../model/challenge';
import { challengeKeyAction } from '../model/challenge-keys';
import { challengeTiles } from '../model/challenge-tiles';
import { ChallengeQuestion } from './challenge-question';
import styles from './challenge.module.css';
import { GameBusy, GameError, GameFinal, GameLobby, GameLost } from './game-panels';

const bestOf = (module: TeacherModule): BestAttempt | null =>
  module.progress.bestScore === null
    ? null
    : { score: module.progress.bestScore, points: module.progress.bestPoints ?? 0 };

/** Texto que lee el lector de pantalla cuando cambia la fase (región `aria-live`). */
function announcement(state: ChallengeState): string {
  switch (state.phase) {
    case 'question':
      return state.step
        ? `Pregunta ${state.step.position} de ${state.step.total}. ${state.step.question.prompt}`
        : '';
    case 'answered': {
      const { result } = state;
      if (!result) {
        return '';
      }
      const verdict = result.timedOut
        ? 'Se acabó el tiempo.'
        : result.correct
          ? 'Correcto.'
          : 'Incorrecto.';
      return `${verdict} ${result.pointsGained} puntos ganados, racha de ${result.streak}.${
        result.feedback ? ` ${result.feedback}` : ''
      }`;
    }
    case 'finished':
      return state.final
        ? `Partida terminada: ${state.final.score} por ciento. ${
            state.final.passed ? 'Aprobaste.' : 'No alcanzaste el porcentaje necesario.'
          }`
        : '';
    case 'lost':
      return 'Esta partida ya no está disponible.';
    default:
      return '';
  }
}

/**
 * El Desafío GNS dentro de la vista del módulo. Pinta lo que dice `useChallenge` y la API califica:
 * el navegador nunca decide si una respuesta es correcta. El teclado (1–4, 1–5, Retroceso, Enter)
 * se escucha en este contenedor, que recibe el foco al aparecer cada pregunta.
 */
export function ChallengeGame({
  module,
  onFinished,
}: {
  module: TeacherModule;
  onFinished: (completed: boolean) => void;
}) {
  const game = useChallenge({
    moduleId: module.id,
    best: bestOf(module),
    onFinished,
  });
  const { state } = game;
  const containerRef = useRef<HTMLDivElement>(null);
  const questionId = state.step?.question.id ?? null;

  useEffect(() => {
    if (state.phase === 'question') {
      containerRef.current?.focus({ preventScroll: true });
    }
  }, [state.phase, questionId]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (target.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }
    // Enter sobre un botón o enlace ya lo activa el navegador: no se repite.
    if (event.key === 'Enter' && target.closest('button, a')) {
      return;
    }
    const question = state.step?.question ?? null;
    const action = challengeKeyAction({
      key: event.key,
      phase: state.phase,
      questionType: question?.type ?? null,
      optionCount: question ? (question.options ?? challengeTiles(question)).length : 0,
      placedCount: state.placed.length,
    });
    if (!action || !question) {
      return;
    }
    event.preventDefault();
    if (action.type === 'pick') {
      const tile = challengeTiles(question)[action.index];
      if (tile) {
        game.choose(tile.answer);
      }
    } else if (action.type === 'place') {
      const option = question.options?.[action.index];
      if (option) {
        game.place(option.id);
      }
    } else if (action.type === 'unplaceLast') {
      game.unplaceLast();
    } else if (action.type === 'confirm') {
      game.confirmOrder();
    } else {
      game.advance();
    }
  }

  const handlers = {
    choose: game.choose,
    place: game.place,
    unplace: game.unplace,
    confirmOrder: game.confirmOrder,
    timeout: game.timeout,
    advance: game.advance,
  };

  let body;
  if (state.phase === 'starting' || state.phase === 'loadingNext') {
    body = <GameBusy>Preparando la pregunta…</GameBusy>;
  } else if (
    (state.phase === 'question' || state.phase === 'submitting' || state.phase === 'answered') &&
    state.step
  ) {
    body = (
      <ChallengeQuestion
        key={state.step.question.id}
        step={state.step}
        state={state}
        handlers={handlers}
      />
    );
  } else if (state.phase === 'finished' && state.final) {
    body = (
      <GameFinal
        final={state.final}
        best={state.best}
        passedTitle="¡Aprobaste el Desafío GNS!"
        threshold={module.challenge.approvalThreshold}
        subject="este módulo"
        onStart={game.start}
      />
    );
  } else if (state.phase === 'lost') {
    body = <GameLost best={state.best} onStart={game.start} />;
  } else if (state.phase === 'error') {
    body = <GameError message={state.errorMessage ?? ''} onRetry={game.retry} />;
  } else {
    const { questionCount, approvalThreshold } = module.challenge;
    body = (
      <GameLobby
        kicker="Desafío"
        name="GNS"
        intro="Responde con rapidez y constancia: cada acierto suma puntos y la racha los multiplica."
        rules={[
          questionCount === 1 ? '1 pregunta' : `${questionCount} preguntas`,
          `Apruebas con ${approvalThreshold}%`,
        ]}
        best={state.best}
        onStart={game.start}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.game}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      aria-label="Desafío GNS"
      role="group"
    >
      {body}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement(state)}
      </div>
    </div>
  );
}
