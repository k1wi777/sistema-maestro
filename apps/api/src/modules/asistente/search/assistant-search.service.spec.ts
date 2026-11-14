import type { AssistantSuggestion } from '@gns/shared';
import type { FaqsService } from '../faqs/faqs.service';
import type { AssistantSearchRepository, FaqMatch } from './assistant-search.repository';
import { AssistantSearchService, decideOutcome, rankMatches } from './assistant-search.service';

const match = (question: string, score: number, strongMatches = 1): FaqMatch => ({
  id: `id-${question}`,
  category: 'Convivencia',
  question,
  answer: `Respuesta de ${question}`,
  source: null,
  score,
  strongMatches,
});

const suggestion = (question: string): AssistantSuggestion => ({
  id: `id-${question}`,
  category: 'Convivencia',
  question,
});

describe('rankMatches', () => {
  it('orders by score, then strong matches, then question alphabetically', () => {
    const ranked = rankMatches([
      match('c', 0.5, 1),
      match('b', 0.8, 1),
      match('a', 0.8, 2),
      match('d', 0.8, 1),
    ]);

    expect(ranked.map((m) => m.question)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('does not mutate its input', () => {
    const input = [match('b', 0.1), match('a', 0.9)];

    rankMatches(input);

    expect(input.map((m) => m.question)).toEqual(['b', 'a']);
  });
});

describe('decideOutcome', () => {
  it('answers with the best match when it reaches the 0.6 threshold', () => {
    const outcome = decideOutcome([match('b', 0.6), match('a', 0.4)], []);

    expect(outcome).toMatchObject({ status: 'answered', faq: { question: 'b' } });
  });

  it('does not answer just below the threshold and suggests the partial matches', () => {
    const outcome = decideOutcome([match('a', 0.59), match('b', 0.2)], [suggestion('x')]);

    expect(outcome).toEqual({
      status: 'unanswered',
      registrable: true,
      suggestions: [suggestion('a'), suggestion('b')],
    });
  });

  it('offers up to 3 related questions at 0.5 or more, never the answered one', () => {
    const outcome = decideOutcome(
      [
        match('best', 1),
        match('r1', 0.9),
        match('r2', 0.7),
        match('r3', 0.5),
        match('r4', 0.5),
        match('low', 0.49),
      ],
      [],
    );

    expect(outcome).toMatchObject({ status: 'answered' });
    const related = (outcome as { related: AssistantSuggestion[] }).related;
    expect(related.map((r) => r.question)).toEqual(['r1', 'r2', 'r3']);
  });

  it('limits the suggestions to 4', () => {
    const matches = ['a', 'b', 'c', 'd', 'e'].map((q, i) => match(q, 0.4 - i * 0.01));

    const outcome = decideOutcome(matches, []);

    expect((outcome as { suggestions: unknown[] }).suggestions).toHaveLength(4);
  });

  it('falls back to the first active questions when nothing matches, limited to 4', () => {
    const fallback = ['a', 'b', 'c', 'd', 'e'].map(suggestion);

    const outcome = decideOutcome([], fallback);

    expect(outcome).toMatchObject({
      status: 'unanswered',
      suggestions: fallback.slice(0, 4),
    });
  });
});

describe('AssistantSearchService', () => {
  function setup(lexemes: number, matches: FaqMatch[]) {
    const repository = {
      countSignificantLexemes: jest.fn(() => Promise.resolve(lexemes)),
      scoreMatches: jest.fn(() => Promise.resolve(matches)),
    } satisfies AssistantSearchRepository;
    const listActive = jest.fn(() =>
      Promise.resolve({
        items: ['a', 'b', 'c', 'd', 'e'].map((q) => ({
          ...suggestion(q),
          answer: '',
          source: null,
        })),
      }),
    );
    const faqs = { listActive } as unknown as FaqsService;
    return { service: new AssistantSearchService(repository, faqs), repository, listActive };
  }

  it('does not score a question without significant words and marks it as not registrable', async () => {
    const { service, repository } = setup(0, []);

    const outcome = await service.search('hola');

    expect(repository.scoreMatches).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ status: 'unanswered', registrable: false });
    expect((outcome as { suggestions: unknown[] }).suggestions).toHaveLength(4);
  });

  it('marks an unmatched question with significant words as registrable', async () => {
    const { service } = setup(2, []);

    await expect(service.search('algo sin coincidencias')).resolves.toMatchObject({
      status: 'unanswered',
      registrable: true,
    });
  });

  it('answers when the database finds a strong match', async () => {
    const { service, listActive } = setup(2, [match('tarde', 1)]);

    await expect(service.search('un niño llega tarde mucho')).resolves.toMatchObject({
      status: 'answered',
      faq: { question: 'tarde' },
      related: [],
    });
    expect(listActive).not.toHaveBeenCalled();
  });
});
