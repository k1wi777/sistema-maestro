import type { AssistantAnswer } from '@gns/shared';
import { assistantQuerySchema } from '@gns/shared';

import { conversationReducer, initialConversation } from './conversation';

const ID = '11111111-1111-4111-8111-111111111111';
const ANSWERED: AssistantAnswer = {
  status: 'answered',
  faq: {
    id: ID,
    category: 'Convivencia',
    question: '¿Qué hago?',
    answer: 'Esto.',
    source: 'Manual',
  },
  related: [{ id: ID, category: 'Convivencia', question: '¿Y luego?' }],
};
const UNANSWERED: AssistantAnswer = {
  status: 'unanswered',
  suggestions: [{ id: ID, category: 'Institucional', question: '¿Jornada?' }],
};

describe('conversation', () => {
  it('starts with the welcome message and no pending question', () => {
    const state = initialConversation();
    expect(state.messages.map((message) => message.kind)).toEqual(['welcome']);
    expect(state.pending).toBeNull();
  });

  it('adds the question and the programmed answer with its related questions', () => {
    let state = conversationReducer(initialConversation(), { type: 'ask', question: '¿Qué hago?' });
    expect(state.pending).toBe('¿Qué hago?');
    state = conversationReducer(state, { type: 'answered', answer: ANSWERED });
    expect(state.pending).toBeNull();
    expect(state.messages.map((message) => message.kind)).toEqual([
      'welcome',
      'question',
      'answer',
    ]);
    const reply = state.messages[2];
    expect(reply?.kind === 'answer' && reply.related).toHaveLength(1);
  });

  it('reports an unanswered question with the suggestions of the API', () => {
    let state = conversationReducer(initialConversation(), { type: 'ask', question: '¿Salida?' });
    state = conversationReducer(state, { type: 'answered', answer: UNANSWERED });
    const reply = state.messages[2];
    expect(reply?.kind).toBe('unanswered');
    expect(reply?.kind === 'unanswered' && reply.suggestions[0]?.question).toBe('¿Jornada?');
  });

  it('allows a single query at a time', () => {
    const first = conversationReducer(initialConversation(), { type: 'ask', question: 'Uno' });
    const second = conversationReducer(first, { type: 'ask', question: 'Dos' });
    expect(second).toBe(first);
  });

  it('ignores a late answer when nothing is pending (conversation reset in between)', () => {
    const reset = conversationReducer(
      conversationReducer(initialConversation(), { type: 'ask', question: 'Uno' }),
      { type: 'reset' },
    );
    expect(conversationReducer(reset, { type: 'answered', answer: ANSWERED })).toBe(reset);
    expect(conversationReducer(reset, { type: 'failed', message: 'x' })).toBe(reset);
  });

  it('keeps the question after a failure and retries it without repeating it', () => {
    let state = conversationReducer(initialConversation(), { type: 'ask', question: '¿Qué hago?' });
    state = conversationReducer(state, { type: 'failed', message: 'Sin conexión.' });
    expect(state.pending).toBeNull();
    expect(state.messages.map((message) => message.kind)).toEqual(['welcome', 'question', 'error']);
    state = conversationReducer(state, { type: 'retry' });
    expect(state.pending).toBe('¿Qué hago?');
    expect(state.messages.map((message) => message.kind)).toEqual(['welcome', 'question']);
    state = conversationReducer(state, { type: 'answered', answer: ANSWERED });
    expect(state.messages.map((message) => message.kind)).toEqual([
      'welcome',
      'question',
      'answer',
    ]);
  });

  it('starts over with a new conversation', () => {
    const state = conversationReducer(
      conversationReducer(initialConversation(), { type: 'ask', question: 'Uno' }),
      { type: 'reset' },
    );
    expect(state).toEqual(initialConversation());
  });

  it('limits the question to between 2 and 200 characters once trimmed', () => {
    const check = (question: string) => assistantQuerySchema.safeParse({ question }).success;
    expect(check(' a ')).toBe(false);
    expect(check('ab')).toBe(true);
    expect(check('x'.repeat(200))).toBe(true);
    expect(check('x'.repeat(201))).toBe(false);
  });
});
