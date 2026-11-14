import {
  assistantQuerySchema,
  createFaqSchema,
  faqListQuerySchema,
  unansweredListQuerySchema,
  updateFaqSchema,
} from '@gns/shared';

const valid = {
  category: 'Convivencia',
  question: '¿Qué hago?',
  answer: 'Esto.',
};

describe('createFaqSchema (R2, R5)', () => {
  it('is active by default and trims the texts', () => {
    const parsed = createFaqSchema.parse({ ...valid, question: '  ¿Qué hago?  ' });

    expect(parsed).toMatchObject({ question: '¿Qué hago?', isActive: true });
  });

  it.each([
    ['an unknown category', { category: 'Otra' }],
    ['an empty question', { question: '   ' }],
    ['a question over 200 characters', { question: 'a'.repeat(201) }],
    ['an empty answer', { answer: '' }],
    ['an answer over 4000 characters', { answer: 'a'.repeat(4001) }],
    ['empty keywords', { keywords: ' ' }],
    ['keywords over 500 characters', { keywords: 'a'.repeat(501) }],
    ['an empty source', { source: '' }],
    ['a source over 120 characters', { source: 'a'.repeat(121) }],
    ['an unknown field', { extra: true }],
    ['an invalid unanswered question id', { unansweredQuestionId: 'no-uuid' }],
  ])('rejects %s', (_name, change) => {
    expect(createFaqSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

describe('updateFaqSchema (R3, R5)', () => {
  it('accepts a partial edit, including deactivating', () => {
    expect(updateFaqSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });

  it('requires at least one field', () => {
    expect(updateFaqSchema.safeParse({}).success).toBe(false);
  });

  it('rejects the link to an unanswered question', () => {
    expect(updateFaqSchema.safeParse({ unansweredQuestionId: crypto.randomUUID() }).success).toBe(
      false,
    );
  });
});

describe('assistantQuerySchema (R12)', () => {
  it('trims and accepts from 2 to 200 characters', () => {
    expect(assistantQuerySchema.parse({ question: '  ab  ' }).question).toBe('ab');
    expect(assistantQuerySchema.safeParse({ question: 'a'.repeat(200) }).success).toBe(true);
  });

  it.each(['', ' a ', 'a'.repeat(201)])('rejects %j', (question) => {
    expect(assistantQuerySchema.safeParse({ question }).success).toBe(false);
  });
});

describe('list queries (R4, R14)', () => {
  it('filters the FAQs by state and category', () => {
    const query = faqListQuerySchema.parse({ isActive: 'false', category: 'Institucional' });

    expect(query.filters).toEqual({ isActive: false, category: 'Institucional' });
  });

  it('lists only the pending unanswered questions by default, by times descending', () => {
    const query = unansweredListQuerySchema.parse({});

    expect(query.filters).toEqual({ status: 'pendiente' });
    expect(query.sort).toEqual({ field: 'times', order: 'desc' });
  });

  it('rejects an unknown status', () => {
    expect(unansweredListQuerySchema.safeParse({ status: 'otra' }).success).toBe(false);
  });
});
