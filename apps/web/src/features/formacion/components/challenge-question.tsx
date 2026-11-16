'use client';

import { ChallengeQuestionType, type ChallengeStep } from '@gns/shared';
import { useEffect, useRef, type CSSProperties } from 'react';

import { Icon } from '@/shared/ui';

import { gameFrame as styles } from '@/shared/training-games';

import { useCountdown } from '../hooks/use-countdown';
import type { ChallengeState } from '../model/challenge';
import { challengeTiles, isSameAnswer, orderedTexts } from '../model/challenge-tiles';

export interface QuestionHandlers {
  choose: (answer: NonNullable<ChallengeState['chosen']>) => void;
  place: (optionId: string) => void;
  unplace: (optionId: string) => void;
  confirmOrder: () => void;
  timeout: () => void;
  advance: () => void;
}

const PROMPT_LABEL: Record<ChallengeQuestionType, string> = {
  [ChallengeQuestionType.MultipleChoice]: 'Elige la respuesta correcta',
  [ChallengeQuestionType.TrueFalse]: 'Verdadero o falso',
  [ChallengeQuestionType.Ordering]: 'Ordena los pasos',
};

function Shape({ shape }: { shape: string }) {
  return <span className={styles.shape} data-shape={shape} aria-hidden="true" />;
}

function Tiles({
  step,
  state,
  onChoose,
}: {
  step: ChallengeStep;
  state: ChallengeState;
  onChoose: QuestionHandlers['choose'];
}) {
  const tiles = challengeTiles(step.question);
  const open = state.phase === 'question';
  const graded = state.phase === 'answered';
  const correct = state.result?.correctAnswer ?? null;

  return (
    <div className={tiles.length === 2 ? styles.optionsTwo : styles.options}>
      {tiles.map((tile, index) => {
        const isCorrect = graded && isSameAnswer(tile.answer, correct);
        const isChosen = isSameAnswer(tile.answer, state.chosen);
        const isWrong = graded && isChosen && !isCorrect;
        const faded = graded && !isCorrect && !isWrong;
        const classes = [
          styles.tile,
          styles[`tile_${tile.color}`],
          isCorrect ? styles.correct : '',
          isWrong ? styles.wrong : '',
          faded ? styles.faded : '',
          !graded && isChosen ? styles.chosen : '',
        ].join(' ');
        return (
          <button
            key={tile.key}
            type="button"
            className={classes}
            disabled={!open}
            aria-pressed={!graded && isChosen ? true : undefined}
            onClick={() => onChoose(tile.answer)}
          >
            <span className={styles.figure}>
              <Shape shape={tile.shape} />
            </span>
            <span className={styles.tileText}>{tile.label}</span>
            {open ? (
              <kbd className={styles.key} aria-hidden="true">
                {index + 1}
              </kbd>
            ) : null}
            {isCorrect ? (
              <span className={styles.seal}>
                <Icon name="check" size={18} />
                <span className="sr-only">Respuesta correcta</span>
              </span>
            ) : null}
            {isWrong ? <span className={styles.yours}>Tu respuesta</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function Ordering({
  step,
  state,
  handlers,
}: {
  step: ChallengeStep;
  state: ChallengeState;
  handlers: QuestionHandlers;
}) {
  const options = step.question.options ?? [];
  const open = state.phase === 'question';
  const graded = state.phase === 'answered';
  const textOf = (id: string) => options.find((option) => option.id === id)?.text ?? '';

  if (graded && state.result) {
    const correct = orderedTexts(step.question, state.result.correctAnswer);
    return (
      <div className={styles.order}>
        <p className={styles.orderTitle}>Orden correcto</p>
        <ol className={styles.orderList}>
          {correct.map((text, index) => (
            <li key={`${index}-${text}`} className={styles.orderStatic}>
              <span className={styles.orderNumber}>{index + 1}</span>
              <span className={styles.tileText}>{text}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className={styles.order}>
      <p className={styles.orderTitle}>Pasos</p>
      <ul className={styles.orderList}>
        {options.map((option, index) => {
          const position = state.placed.indexOf(option.id);
          const placed = position !== -1;
          return (
            <li key={option.id}>
              <button
                type="button"
                className={placed ? styles.stepPlaced : styles.step}
                disabled={!open}
                aria-pressed={placed}
                onClick={() => (placed ? handlers.unplace(option.id) : handlers.place(option.id))}
              >
                <span className={styles.orderNumber}>{placed ? position + 1 : ''}</span>
                <span className={styles.tileText}>{option.text}</span>
                {open && !placed ? (
                  <kbd className={styles.key} aria-hidden="true">
                    {index + 1}
                  </kbd>
                ) : null}
                {placed ? (
                  <span className="sr-only">{`Colocado en el lugar ${position + 1}`}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <p className={styles.orderTitle}>Tu orden</p>
      {state.placed.length === 0 ? (
        <p className={styles.orderHint}>Pulsa los pasos en el orden en que van.</p>
      ) : (
        <ol className={styles.orderList} aria-label="Tu orden">
          {state.placed.map((id, index) => (
            <li key={id} className={styles.orderStatic}>
              <span className={styles.orderNumber}>{index + 1}</span>
              <span className={styles.tileText}>{textOf(id)}</span>
            </li>
          ))}
        </ol>
      )}
      <div className={styles.orderActions}>
        <button
          type="button"
          className={styles.next}
          disabled={!open || state.placed.length !== options.length}
          onClick={handlers.confirmOrder}
        >
          Confirmar orden
        </button>
      </div>
    </div>
  );
}

function Feedback({ state, onAdvance }: { state: ChallengeState; onAdvance: () => void }) {
  const result = state.result;
  const nextRef = useRef<HTMLButtonElement>(null);

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
    <div className={result.correct ? styles.feedbackOk : styles.feedbackBad}>
      <div className={styles.feedbackHead}>
        <b>{title}</b>
        <span className={styles.gain}>
          <Icon name="llama" size={15} fill="solid" />
          {`+${result.pointsGained} pts · racha de ${result.streak}`}
        </span>
      </div>
      {result.feedback ? <p className={styles.feedbackText}>{result.feedback}</p> : null}
      <button ref={nextRef} type="button" className={styles.next} onClick={onAdvance}>
        {result.finished ? 'Ver resultado' : 'Siguiente pregunta'}
      </button>
    </div>
  );
}

/** Pregunta en curso, enviada o calificada: marcador, cuenta regresiva, opciones y retroalimentación. */
export function ChallengeQuestion({
  step,
  state,
  handlers,
}: {
  step: ChallengeStep;
  state: ChallengeState;
  handlers: QuestionHandlers;
}) {
  const { question } = step;
  const running = state.phase === 'question';
  const remaining = useCountdown(question.seconds, running, handlers.timeout);
  const percent = question.seconds > 0 ? Math.min(100, (remaining / question.seconds) * 100) : 0;
  const seconds = Math.ceil(remaining);

  return (
    <div className={styles.questionScreen}>
      <div className={styles.top}>
        <span className={styles.counter}>{`${step.position} / ${step.total}`}</span>
        <span className={styles.points} aria-label={`${state.points} puntos`}>
          {`${state.points} pts`}
        </span>
        <span className={styles.streak} aria-label={`Racha de ${state.streak}`}>
          <Icon name="llama" size={15} fill="solid" />
          {state.streak}
        </span>
      </div>
      <div className={styles.timeBar} aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className={styles.prompt}>
        <span className={styles.promptType}>{PROMPT_LABEL[question.type]}</span>
        <p>{question.prompt}</p>
        <div
          className={styles.ring}
          style={{ '--pct': `${percent}%` } as CSSProperties}
          role="timer"
          aria-label={`Quedan ${seconds} segundos`}
        >
          <span aria-hidden="true">{seconds}</span>
        </div>
      </div>
      {question.type === ChallengeQuestionType.Ordering ? (
        <Ordering step={step} state={state} handlers={handlers} />
      ) : (
        <Tiles step={step} state={state} onChoose={handlers.choose} />
      )}
      {state.phase === 'answered' ? <Feedback state={state} onAdvance={handlers.advance} /> : null}
    </div>
  );
}
