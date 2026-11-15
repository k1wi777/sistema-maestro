'use client';

import { assistantQuerySchema, type FaqView } from '@gns/shared';
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { useRemote, type Remote } from '@/shared/data';

import { askAssistant, listFaqs } from '../api/assistant';
import {
  conversationReducer,
  initialConversation,
  type ConversationState,
} from '../model/conversation';

/** Todas las preguntas frecuentes activas (se piden al abrir el asistente). */
export function useFaqs(): Remote<FaqView[]> {
  return useRemote(listFaqs, 'assistant-faqs');
}

export interface Conversation {
  state: ConversationState;
  /** Envía la pregunta; devuelve el motivo si no es válida (2 a 200 caracteres) y `null` si se envió. */
  ask: (question: string) => string | null;
  retry: () => void;
  /** Vacía la conversación (una consulta en curso se descarta). */
  reset: () => void;
}

/**
 * Conversación con el asistente. Solo una consulta a la vez; si la conversación se vacía mientras
 * llega una respuesta, esa respuesta se descarta (se identifica cada consulta con un número).
 */
export function useConversation(): Conversation {
  const [state, dispatch] = useReducer(conversationReducer, undefined, initialConversation);
  const requestRef = useRef(0);
  const pendingRef = useRef(state.pending);
  useEffect(() => {
    pendingRef.current = state.pending;
  });

  const run = useCallback((question: string) => {
    requestRef.current += 1;
    const request = requestRef.current;
    void askAssistant(question).then((result) => {
      if (request !== requestRef.current) {
        return;
      }
      dispatch(
        result.ok
          ? { type: 'answered', answer: result.data }
          : { type: 'failed', message: result.error.message },
      );
    });
  }, []);

  const ask = useCallback(
    (question: string): string | null => {
      if (pendingRef.current !== null) {
        return null;
      }
      const parsed = assistantQuerySchema.safeParse({ question });
      if (!parsed.success) {
        const reason = parsed.error.issues[0]?.message ?? 'no es válida';
        return `La pregunta ${reason}.`;
      }
      dispatch({ type: 'ask', question: parsed.data.question });
      // Se marca ya como en curso para que un segundo envío inmediato no dispare otra consulta.
      pendingRef.current = parsed.data.question;
      run(parsed.data.question);
      return null;
    },
    [run],
  );

  const retry = useCallback(() => {
    const last = state.messages[state.messages.length - 1];
    if (last?.kind === 'error' && pendingRef.current === null) {
      dispatch({ type: 'retry' });
      pendingRef.current = last.question;
      run(last.question);
    }
  }, [run, state.messages]);

  const reset = useCallback(() => {
    requestRef.current += 1;
    pendingRef.current = null;
    dispatch({ type: 'reset' });
  }, []);

  return { state, ask, retry, reset };
}
