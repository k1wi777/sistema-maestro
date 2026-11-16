import type { FaqAdminView } from '@gns/shared';

import {
  EMPTY_FAQ_FORM,
  apiFaqFieldErrors,
  initialFaqForm,
  validateFaqCreate,
  validateFaqUpdate,
} from './faq-form';

const original: FaqAdminView = {
  id: '11111111-1111-4111-8111-111111111111',
  category: 'Convivencia',
  question: '¿Pregunta?',
  answer: 'Respuesta',
  source: 'Manual',
  keywords: 'clave',
  isActive: true,
  updatedById: null,
  createdAt: new Date('2026-11-01T15:00:00Z'),
  updatedAt: new Date('2026-11-01T15:00:00Z'),
};
const UNANSWERED = '22222222-2222-4222-8222-222222222222';

describe('initialFaqForm', () => {
  it('precarga la pregunta sin respuesta recortada al máximo', () => {
    expect(initialFaqForm(null, 'x'.repeat(250)).question).toHaveLength(200);
  });

  it('toma los valores de la pregunta que se edita', () => {
    expect(initialFaqForm(original)).toMatchObject({ question: '¿Pregunta?', source: 'Manual' });
  });
});

describe('validateFaqCreate', () => {
  it('omite los opcionales vacíos y vincula la pregunta sin respuesta', () => {
    const result = validateFaqCreate(
      { ...EMPTY_FAQ_FORM, category: 'Institucional', question: '¿Algo?', answer: 'Sí.' },
      UNANSWERED,
    );
    expect(result).toEqual({
      ok: true,
      input: {
        category: 'Institucional',
        question: '¿Algo?',
        answer: 'Sí.',
        isActive: true,
        unansweredQuestionId: UNANSWERED,
      },
    });
  });

  it('señala los campos inválidos', () => {
    const result = validateFaqCreate(EMPTY_FAQ_FORM);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(['answer', 'category', 'question']);
    }
  });
});

describe('validateFaqUpdate', () => {
  const same = initialFaqForm(original);

  it('sin cambios no envía nada', () => {
    expect(validateFaqUpdate(same, original)).toEqual({ ok: false, errors: {}, unchanged: true });
  });

  it('envía solo los campos cambiados', () => {
    expect(validateFaqUpdate({ ...same, answer: 'Nueva' }, original)).toEqual({
      ok: true,
      input: { answer: 'Nueva' },
    });
  });

  it('no deja vaciar palabras clave ni fuente una vez guardadas', () => {
    const result = validateFaqUpdate({ ...same, source: '' }, original);
    expect(result).toEqual({
      ok: false,
      errors: { source: 'Una vez guardado, este campo no se puede dejar vacío.' },
      unchanged: false,
    });
  });

  it('rechaza una pregunta vacía', () => {
    expect(validateFaqUpdate({ ...same, question: ' ' }, original).ok).toBe(false);
  });
});

describe('apiFaqFieldErrors', () => {
  it('toma solo los campos del formulario', () => {
    expect(
      apiFaqFieldErrors([
        { field: 'answer', reason: 'es larga' },
        { field: 'x', reason: 'y' },
      ]),
    ).toEqual({
      answer: 'Es larga',
    });
  });
});
