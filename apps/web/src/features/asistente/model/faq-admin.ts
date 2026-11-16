import type { FaqAdminView, UnansweredQuestion } from '@gns/shared';

import { groupByCategory, type FaqGroup } from './starters';

export type FaqStatusFilter = 'all' | 'active' | 'inactive';

export interface FaqAdminFilters {
  /** Vacío = todas las categorías. */
  category: string;
  status: FaqStatusFilter;
}

/** Preguntas que cumplen los filtros, agrupadas por categoría y con la pregunta en orden alfabético. */
export function groupAdminFaqs(
  faqs: readonly FaqAdminView[],
  filters: FaqAdminFilters,
): FaqGroup<FaqAdminView>[] {
  const visible = faqs.filter(
    (faq) =>
      (filters.category === '' || faq.category === filters.category) &&
      (filters.status === 'all' || faq.isActive === (filters.status === 'active')),
  );
  return groupByCategory(visible).map((group) => ({
    ...group,
    faqs: [...group.faqs].sort((a, b) => a.question.localeCompare(b.question, 'es')),
  }));
}

/** Recorta un texto largo (sin las marcas de negrita) a `max` caracteres con puntos suspensivos, sin cortar en medio de una palabra. */
export function excerpt(text: string, max: number): string {
  const flat = text.replace(/\*\*/gu, '').replace(/\s+/gu, ' ').trim();
  if (flat.length <= max) {
    return flat;
  }
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Quién la hizo más recientemente: la ocurrencia con la fecha más reciente. */
export function latestOccurrence(
  question: UnansweredQuestion,
): UnansweredQuestion['occurrences'][number] | null {
  return (
    [...question.occurrences].sort((a, b) => b.askedAt.getTime() - a.askedAt.getTime())[0] ?? null
  );
}
