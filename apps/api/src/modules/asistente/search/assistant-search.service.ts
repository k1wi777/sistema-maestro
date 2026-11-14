import { Inject, Injectable } from '@nestjs/common';
import type { AssistantSuggestion, FaqView } from '@gns/shared';
import { FaqsService } from '../faqs/faqs.service';
import {
  ANSWER_THRESHOLD,
  FILLER_TEXT,
  MAX_RELATED,
  MAX_SUGGESTIONS,
  RELATED_THRESHOLD,
} from './assistant-search.constants';
import {
  ASSISTANT_SEARCH_REPOSITORY,
  type AssistantSearchRepository,
  type FaqMatch,
} from './assistant-search.repository';

export type SearchOutcome =
  | { status: 'answered'; faq: FaqView; related: AssistantSuggestion[] }
  | {
      status: 'unanswered';
      suggestions: AssistantSuggestion[];
      /** Había palabras significativas: la pregunta merece registrarse (R13). */
      registrable: boolean;
    };

const toSuggestion = (match: { id: string; category: string; question: string }) => ({
  id: match.id,
  category: match.category,
  question: match.question,
});

/** Desempate: puntaje, coincidencias fuertes y pregunta en orden alfabético (R8). */
export function rankMatches(matches: readonly FaqMatch[]): FaqMatch[] {
  return [...matches].sort(
    (a, b) =>
      b.score - a.score ||
      b.strongMatches - a.strongMatches ||
      a.question.localeCompare(b.question, 'es'),
  );
}

/**
 * Aplica los umbrales a las coincidencias ya calculadas por la base: responde con la mejor si
 * alcanza `ANSWER_THRESHOLD` (R8) con hasta `MAX_RELATED` relacionadas (R10); si no, sugiere las de
 * mayor puntaje parcial (R11).
 */
export function decideOutcome(
  matches: readonly FaqMatch[],
  fallback: readonly AssistantSuggestion[],
): SearchOutcome {
  const ranked = rankMatches(matches);
  const [best, ...others] = ranked;
  if (best && best.score >= ANSWER_THRESHOLD) {
    return {
      status: 'answered',
      faq: {
        id: best.id,
        category: best.category,
        question: best.question,
        answer: best.answer,
        source: best.source,
      },
      related: others
        .filter((match) => match.score >= RELATED_THRESHOLD)
        .slice(0, MAX_RELATED)
        .map(toSuggestion),
    };
  }
  const partial = ranked.slice(0, MAX_SUGGESTIONS).map(toSuggestion);
  return {
    status: 'unanswered',
    suggestions: partial.length > 0 ? partial : fallback.slice(0, MAX_SUGGESTIONS),
    registrable: true,
  };
}

@Injectable()
export class AssistantSearchService {
  constructor(
    @Inject(ASSISTANT_SEARCH_REPOSITORY) private readonly repository: AssistantSearchRepository,
    private readonly faqs: FaqsService,
  ) {}

  /** Busca `question` (ya recortada y de 2 a 200 caracteres) entre las preguntas activas. */
  async search(question: string): Promise<SearchOutcome> {
    const lexemes = await this.repository.countSignificantLexemes(question, FILLER_TEXT);
    const matches = lexemes > 0 ? await this.repository.scoreMatches(question, FILLER_TEXT) : [];
    const outcome = decideOutcome(matches, matches.length > 0 ? [] : await this.fallback());
    // Sin palabras significativas («hola», «¿qué?») no hay nada que registrar (R13).
    return outcome.status === 'unanswered' ? { ...outcome, registrable: lexemes > 0 } : outcome;
  }

  /** Las primeras en el orden de lectura (R1), por si ninguna coincide. */
  private async fallback(): Promise<AssistantSuggestion[]> {
    const { items } = await this.faqs.listActive();
    return items.slice(0, MAX_SUGGESTIONS).map(toSuggestion);
  }
}
