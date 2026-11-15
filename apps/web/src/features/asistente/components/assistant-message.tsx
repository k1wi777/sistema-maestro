import type { AssistantSuggestion, FaqView } from '@gns/shared';
import type { ReactNode } from 'react';

import { Button } from '@/shared/ui';

import { parseAnswerText, type Inline } from '../model/answer-text';
import type { Message } from '../model/conversation';
import styles from './assistant.module.css';

export function Suggestions({
  items,
  disabled,
  onPick,
}: {
  items: readonly { id: string; question: string }[];
  disabled: boolean;
  onPick: (question: string) => void;
}) {
  return (
    <div className={styles.suggestions}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={styles.suggestion}
          disabled={disabled}
          onClick={() => onPick(item.question)}
        >
          {item.question}
        </button>
      ))}
    </div>
  );
}

function Bot({ children }: { children: ReactNode }) {
  return (
    <div className={styles.message}>
      <span className={styles.avatar} aria-hidden="true">
        GNS
      </span>
      <div className={styles.bubble}>{children}</div>
    </div>
  );
}

interface AssistantMessageProps {
  message: Exclude<Message, { kind: 'welcome' }>;
  busy: boolean;
  onPick: (question: string) => void;
  onShowAll: () => void;
  onRetry: () => void;
}

/** Un mensaje de la conversación: la pregunta del docente o la respuesta del asistente. */
export function AssistantMessage({
  message,
  busy,
  onPick,
  onShowAll,
  onRetry,
}: AssistantMessageProps) {
  switch (message.kind) {
    case 'question':
      return (
        <div className={`${styles.message} ${styles.user}`}>
          <div className={styles.bubble}>
            <p>{message.text}</p>
          </div>
        </div>
      );
    case 'answer':
      return (
        <AnswerMessage faq={message.faq} related={message.related} busy={busy} onPick={onPick} />
      );
    case 'unanswered':
      return (
        <Bot>
          <p>
            Todavía no tengo una respuesta programada para esa pregunta. Coordinación académica
            revisa las preguntas sin respuesta para agregarlas. Mientras tanto, consulta
            directamente con coordinación.
          </p>
          {message.suggestions.length > 0 ? (
            <>
              <p className={styles.subtitle}>Quizá te sirva alguna de estas:</p>
              <Suggestions items={message.suggestions} disabled={busy} onPick={onPick} />
            </>
          ) : null}
          <button type="button" className={styles.linkButton} onClick={onShowAll}>
            Ver todas las preguntas
          </button>
        </Bot>
      );
    case 'error':
      return (
        <Bot>
          <p>{message.text}</p>
          <div className={styles.suggestions}>
            <Button variant="outline" size="sm" disabled={busy} onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        </Bot>
      );
  }
}

function Parts({ parts }: { parts: Inline[] }) {
  return parts.map((part, index) =>
    part.bold ? <strong key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>,
  );
}

/** Respuesta como texto con párrafos, viñetas y negrita; nunca HTML (ver `parseAnswerText`). */
function AnswerText({ text }: { text: string }) {
  return parseAnswerText(text).map((block, index) =>
    block.kind === 'list' ? (
      <ul key={index} className={styles.answerList}>
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>
            <Parts parts={item} />
          </li>
        ))}
      </ul>
    ) : (
      <p key={index}>
        <Parts parts={block.parts} />
      </p>
    ),
  );
}

function AnswerMessage({
  faq,
  related,
  busy,
  onPick,
}: {
  faq: FaqView;
  related: readonly AssistantSuggestion[];
  busy: boolean;
  onPick: (question: string) => void;
}) {
  return (
    <Bot>
      <AnswerText text={faq.answer} />
      {faq.source ? <p className={styles.source}>Fuente: {faq.source}</p> : null}
      {related.length > 0 ? (
        <>
          <p className={styles.subtitle}>Preguntas relacionadas</p>
          <Suggestions items={related} disabled={busy} onPick={onPick} />
        </>
      ) : null}
    </Bot>
  );
}

export { Bot };
