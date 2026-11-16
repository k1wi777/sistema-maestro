import type { FaqAdminView, UnansweredQuestion } from '@gns/shared';

import { excerpt, groupAdminFaqs, latestOccurrence } from './faq-admin';

function faq(overrides: Partial<FaqAdminView>): FaqAdminView {
  return {
    id: 'f-1',
    category: 'Convivencia',
    question: 'Pregunta',
    answer: 'Respuesta',
    source: null,
    keywords: null,
    isActive: true,
    updatedById: null,
    createdAt: new Date('2026-11-01T15:00:00Z'),
    updatedAt: new Date('2026-11-01T15:00:00Z'),
    ...overrides,
  };
}

const FAQS = [
  faq({ id: '1', category: 'Institucional', question: 'B pregunta' }),
  faq({ id: '2', category: 'Convivencia', question: 'Z pregunta', isActive: false }),
  faq({ id: '3', category: 'Convivencia', question: 'A pregunta' }),
];

describe('groupAdminFaqs', () => {
  it('agrupa en el orden de las categorías y ordena las preguntas', () => {
    const groups = groupAdminFaqs(FAQS, { category: '', status: 'all' });
    expect(groups.map((group) => group.category)).toEqual(['Convivencia', 'Institucional']);
    expect(groups[0]?.faqs.map((item) => item.id)).toEqual(['3', '2']);
  });

  it('filtra por categoría y por estado', () => {
    expect(groupAdminFaqs(FAQS, { category: 'Institucional', status: 'all' })).toHaveLength(1);
    const inactive = groupAdminFaqs(FAQS, { category: '', status: 'inactive' });
    expect(inactive.flatMap((group) => group.faqs.map((item) => item.id))).toEqual(['2']);
    expect(groupAdminFaqs(FAQS, { category: 'Institucional', status: 'inactive' })).toEqual([]);
  });
});

describe('excerpt', () => {
  it('no toca los textos cortos', () => {
    expect(excerpt('Hola  mundo', 50)).toBe('Hola mundo');
  });

  it('quita las marcas de negrita', () => {
    expect(excerpt('Es **muy** claro', 50)).toBe('Es muy claro');
  });

  it('recorta sin partir palabras', () => {
    expect(excerpt('uno dos tres cuatro cinco', 14)).toBe('uno dos tres…');
  });
});

describe('latestOccurrence', () => {
  it('devuelve la ocurrencia más reciente', () => {
    const question = {
      occurrences: [
        {
          id: 'o1',
          user: { id: 'u1', name: 'Laura Demo' },
          askedAt: new Date('2026-11-06T10:00:00Z'),
        },
        {
          id: 'o2',
          user: { id: 'u2', name: 'Andrés Demo' },
          askedAt: new Date('2026-11-08T10:00:00Z'),
        },
      ],
    } as UnansweredQuestion;
    expect(latestOccurrence(question)?.user.name).toBe('Andrés Demo');
    expect(latestOccurrence({ occurrences: [] } as unknown as UnansweredQuestion)).toBeNull();
  });
});
