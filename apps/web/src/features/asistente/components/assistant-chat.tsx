'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { LoadError } from '@/shared/data';
import { Button, TextArea } from '@/shared/ui';

import { useFaqs, type Conversation } from '../hooks/use-assistant';
import { pickStarters } from '../model/starters';
import { AssistantMessage, Bot, Suggestions } from './assistant-message';
import { FaqCatalogDialog } from './faq-catalog-dialog';
import styles from './assistant.module.css';

/**
 * Conversación con el asistente de preguntas frecuentes (sin IA): sugerencias, respuestas
 * programadas con su fuente, preguntas relacionadas y el campo para escribir. El estado de la
 * conversación lo pone quien lo monta, de modo que el botón «¿Dudas?» la conserva al cerrarse.
 */
export function AssistantChat({ conversation }: { conversation: Conversation }) {
  const { state, ask, retry } = conversation;
  const faqs = useFaqs();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = state.pending !== null;
  const lastId = state.messages[state.messages.length - 1]?.id ?? 0;

  const starters = useMemo(
    () => (faqs.state.status === 'ready' ? pickStarters(faqs.state.data) : []),
    [faqs.state],
  );

  // El último mensaje queda a la vista; la primera vez (solo el saludo) no se mueve la página.
  useEffect(() => {
    if (lastId > 0) {
      endRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [lastId, busy]);

  function send(question: string): boolean {
    const failure = ask(question);
    setError(failure);
    return failure === null;
  }

  function handlePick(question: string) {
    send(question);
  }

  function handleSubmit() {
    if (send(draft)) {
      setDraft('');
    }
  }

  return (
    <div className={styles.chat}>
      <div className={styles.log} aria-live="polite">
        {state.messages.map((message) =>
          message.kind === 'welcome' ? (
            <Bot key={message.id}>
              <p>¡Hola! ¿En qué te ayudo hoy? Elige una pregunta o escribe la tuya:</p>
              {faqs.state.status === 'loading' ? (
                <p className={styles.thinking}>Cargando preguntas…</p>
              ) : null}
              {starters.length > 0 ? (
                <Suggestions items={starters} disabled={busy} onPick={handlePick} />
              ) : null}
              {faqs.state.status === 'ready' ? (
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => setCatalogOpen(true)}
                >
                  Ver todas las preguntas
                </button>
              ) : null}
            </Bot>
          ) : (
            <AssistantMessage
              key={message.id}
              message={message}
              busy={busy}
              onPick={handlePick}
              onShowAll={() => setCatalogOpen(true)}
              onRetry={retry}
            />
          ),
        )}
        {busy ? (
          <Bot>
            <div role="status" className={styles.thinking}>
              <span className="sr-only">Buscando la respuesta…</span>
              <span className={styles.dots} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          </Bot>
        ) : null}
        <div ref={endRef} />
      </div>
      {faqs.state.status === 'error' ? (
        <LoadError
          error={faqs.state.error}
          title="No pudimos cargar las preguntas sugeridas"
          onRetry={faqs.reload}
        />
      ) : null}

      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <div className={styles.formRow}>
          <TextArea
            label="Tu pregunta para el Asistente GNS"
            rows={2}
            value={draft}
            placeholder="Escribe tu pregunta…"
            help="Entre 2 y 200 caracteres. No escribas nombres, documentos ni datos de salud de los estudiantes."
            error={error ?? undefined}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button type="submit" endIcon="enviar" disabled={busy}>
            Enviar
          </Button>
        </div>
        <p className={styles.note}>
          Las respuestas están programadas a partir de los documentos institucionales. Si tu
          pregunta no está, consulta con coordinación.
        </p>
      </form>

      {catalogOpen && faqs.state.status === 'ready' ? (
        <FaqCatalogDialog
          faqs={faqs.state.data}
          busy={busy}
          onPick={handlePick}
          onClose={() => setCatalogOpen(false)}
        />
      ) : null}
    </div>
  );
}
