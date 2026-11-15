import type { FaqView } from '@gns/shared';

import { groupByCategory, pickStarters } from './starters';

let counter = 0;
function faq(category: string, question: string): FaqView {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    category,
    question,
    answer: 'Respuesta.',
    source: null,
  };
}

const FAQS = [
  faq('Uso de la plataforma', 'U1'),
  faq('Convivencia', 'C1'),
  faq('Convivencia', 'C2'),
  faq('Convivencia', 'C3'),
  faq('Institucional', 'I1'),
  faq('Talento humano y beneficios', 'T1'),
  faq('Talento humano y beneficios', 'T2'),
  faq('Otra categoría', 'O1'),
];

describe('starters', () => {
  it('groups the questions by category in the order of the assistant', () => {
    expect(groupByCategory(FAQS).map((group) => group.category)).toEqual([
      'Convivencia',
      'Talento humano y beneficios',
      'Institucional',
      'Uso de la plataforma',
      'Otra categoría',
    ]);
  });

  it('spreads the suggestions across categories, one per category per round', () => {
    expect(pickStarters(FAQS, 5).map((item) => item.question)).toEqual([
      'C1',
      'T1',
      'I1',
      'U1',
      'O1',
    ]);
  });

  it('caps the suggestions at eight and returns fewer when there are fewer questions', () => {
    expect(pickStarters(FAQS)).toHaveLength(8);
    expect(pickStarters(FAQS.slice(0, 2))).toHaveLength(2);
    expect(pickStarters([])).toEqual([]);
  });
});
