import { FAQ_CATEGORIES, type FaqView } from '@gns/shared';

export const STARTERS_LIMIT = 8;

/** Posición de la categoría en `FAQ_CATEGORIES`; las desconocidas van al final, por orden alfabético. */
function categoryRank(category: string): number {
  const index = (FAQ_CATEGORIES as readonly string[]).indexOf(category);
  return index === -1 ? FAQ_CATEGORIES.length : index;
}

export interface FaqGroup {
  category: string;
  faqs: FaqView[];
}

/** Preguntas agrupadas por categoría, en el orden de `FAQ_CATEGORIES`, para «Ver todas las preguntas». */
export function groupByCategory(faqs: readonly FaqView[]): FaqGroup[] {
  const groups = new Map<string, FaqView[]>();
  for (const faq of faqs) {
    groups.set(faq.category, [...(groups.get(faq.category) ?? []), faq]);
  }
  return [...groups.entries()]
    .map(([category, items]) => ({ category, faqs: items }))
    .sort(
      (a, b) =>
        categoryRank(a.category) - categoryRank(b.category) ||
        a.category.localeCompare(b.category, 'es'),
    );
}

/**
 * Sugerencias iniciales: hasta `limit` preguntas repartidas entre las categorías (una por
 * categoría en cada vuelta, en el orden de `FAQ_CATEGORIES`), para que no domine una sola.
 */
export function pickStarters(faqs: readonly FaqView[], limit = STARTERS_LIMIT): FaqView[] {
  const queues = groupByCategory(faqs).map((group) => [...group.faqs]);
  const picked: FaqView[] = [];
  while (picked.length < limit && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next && picked.length < limit) {
        picked.push(next);
      }
    }
  }
  return picked;
}
