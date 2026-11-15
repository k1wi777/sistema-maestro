import type { AssistantAnswer, AssistantSuggestion, FaqView } from '@gns/shared';

/**
 * Mensajes de la conversación. Solo viven en la memoria del componente: no se guardan en
 * `localStorage` ni `sessionStorage` porque una pregunta escrita podría traer un nombre.
 */
export type Message =
  | { id: number; kind: 'welcome' }
  | { id: number; kind: 'question'; text: string }
  | { id: number; kind: 'answer'; faq: FaqView; related: AssistantSuggestion[] }
  | { id: number; kind: 'unanswered'; suggestions: AssistantSuggestion[] }
  | { id: number; kind: 'error'; text: string; question: string };

export interface ConversationState {
  messages: Message[];
  /** Pregunta en curso: solo hay una consulta a la vez. */
  pending: string | null;
  nextId: number;
}

export type ConversationAction =
  | { type: 'ask'; question: string }
  | { type: 'answered'; answer: AssistantAnswer }
  | { type: 'failed'; message: string }
  | { type: 'retry' }
  | { type: 'reset' };

export function initialConversation(): ConversationState {
  return { messages: [{ id: 0, kind: 'welcome' }], pending: null, nextId: 1 };
}

type NewMessage<T = Message> = T extends unknown ? Omit<T, 'id'> : never;

function append(state: ConversationState, message: NewMessage): ConversationState {
  const next: Message = { ...message, id: state.nextId };
  return { ...state, messages: [...state.messages, next], nextId: state.nextId + 1 };
}

export function conversationReducer(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  switch (action.type) {
    case 'ask':
      if (state.pending !== null) {
        return state;
      }
      return {
        ...append(state, { kind: 'question', text: action.question }),
        pending: action.question,
      };
    case 'answered': {
      if (state.pending === null) {
        return state;
      }
      const reply =
        action.answer.status === 'answered'
          ? ({ kind: 'answer', faq: action.answer.faq, related: action.answer.related } as const)
          : ({ kind: 'unanswered', suggestions: action.answer.suggestions } as const);
      return { ...append(state, reply), pending: null };
    }
    case 'failed':
      if (state.pending === null) {
        return state;
      }
      return {
        ...append(state, { kind: 'error', text: action.message, question: state.pending }),
        pending: null,
      };
    case 'retry': {
      const last = state.messages[state.messages.length - 1];
      if (state.pending !== null || last?.kind !== 'error') {
        return state;
      }
      // La pregunta ya está en la conversación: solo se quita el error y se vuelve a consultar.
      return { ...state, messages: state.messages.slice(0, -1), pending: last.question };
    }
    case 'reset':
      return initialConversation();
  }
}
