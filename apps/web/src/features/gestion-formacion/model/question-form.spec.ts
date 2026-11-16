import {
  changeQuestionType,
  emptyQuestionForm,
  isQuestionDirty,
  questionCountHint,
  toQuestionForm,
  validateQuestionForm,
  type QuestionForm,
} from './question-form';
import { ID } from './test-fixtures';

function choice(overrides: Partial<QuestionForm> = {}): QuestionForm {
  return {
    ...emptyQuestionForm('opcion'),
    prompt: '¿Cuál es correcta?',
    options: [
      { text: 'Una', isCorrect: false },
      { text: 'Dos', isCorrect: true },
    ],
    ...overrides,
  };
}

describe('validateQuestionForm', () => {
  it('opción múltiple válida produce el cuerpo de la API', () => {
    const result = validateQuestionForm(choice({ feedback: ' Bien ' }));
    expect(result).toEqual({
      ok: true,
      input: {
        type: 'opcion',
        prompt: '¿Cuál es correcta?',
        feedback: 'Bien',
        options: [
          { text: 'Una', isCorrect: false },
          { text: 'Dos', isCorrect: true },
        ],
      },
    });
  });

  it('exige enunciado, textos y exactamente una correcta', () => {
    const empty = validateQuestionForm(emptyQuestionForm('opcion'));
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.errors.prompt).toBe('Escribe la pregunta.');
      expect(empty.errors.optionTexts).toEqual({
        0: 'Escríbelo antes de guardar.',
        1: 'Escríbelo antes de guardar.',
      });
    }
    const none = validateQuestionForm(
      choice({
        options: [
          { text: 'a', isCorrect: false },
          { text: 'b', isCorrect: false },
        ],
      }),
    );
    expect(none.ok === false && none.errors.options).toBe('Marca exactamente una opción correcta.');
    const two = validateQuestionForm(
      choice({
        options: [
          { text: 'a', isCorrect: true },
          { text: 'b', isCorrect: true },
        ],
      }),
    );
    expect(two.ok).toBe(false);
  });

  it('limita las opciones a entre 2 y 4', () => {
    const five = Array.from({ length: 5 }, (_, index) => ({
      text: `o${index}`,
      isCorrect: index === 0,
    }));
    const result = validateQuestionForm(choice({ options: five }));
    expect(result.ok === false && result.errors.options).toBe('Usa entre 2 y 4 opciones.');
  });

  it('verdadero o falso lleva su respuesta y sin retroalimentación queda en null', () => {
    const result = validateQuestionForm({
      ...emptyQuestionForm('vf'),
      prompt: 'El cielo es azul',
      trueFalseAnswer: false,
    });
    expect(result).toEqual({
      ok: true,
      input: { type: 'vf', prompt: 'El cielo es azul', feedback: null, trueFalseAnswer: false },
    });
  });

  it('ordenar pasos exige entre 2 y 5 pasos con texto', () => {
    const base = { ...emptyQuestionForm('orden'), prompt: 'Ordena' };
    expect(validateQuestionForm({ ...base, steps: ['uno', 'dos', 'tres'] })).toEqual({
      ok: true,
      input: { type: 'orden', prompt: 'Ordena', feedback: null, steps: ['uno', 'dos', 'tres'] },
    });
    const blank = validateQuestionForm({ ...base, steps: ['uno', ' '] });
    expect(blank.ok === false && blank.errors.stepTexts).toEqual({
      1: 'Escríbelo antes de guardar.',
    });
    const six = validateQuestionForm({ ...base, steps: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(six.ok === false && six.errors.steps).toBe('Usa entre 2 y 5 pasos.');
  });

  it('los campos de otro tipo no estorban', () => {
    const result = validateQuestionForm({
      ...emptyQuestionForm('vf'),
      prompt: 'Algo',
      options: [{ text: '', isCorrect: false }],
      steps: [''],
    });
    expect(result.ok).toBe(true);
  });
});

describe('toQuestionForm', () => {
  it('lee la correcta por isCorrect', () => {
    const form = toQuestionForm({
      id: ID(1),
      sortOrder: 1,
      type: 'opcion',
      prompt: 'p',
      feedback: null,
      trueFalseAnswer: null,
      options: [
        { id: ID(2), text: 'a', isCorrect: false, correctPosition: null },
        { id: ID(3), text: 'b', isCorrect: true, correctPosition: null },
      ],
    });
    expect(form.options).toEqual([
      { text: 'a', isCorrect: false },
      { text: 'b', isCorrect: true },
    ]);
    expect(form.id).toBe(ID(1));
  });

  it('lee los pasos por correctPosition', () => {
    const form = toQuestionForm({
      id: ID(1),
      sortOrder: 1,
      type: 'orden',
      prompt: 'p',
      feedback: 'f',
      trueFalseAnswer: null,
      options: [
        { id: ID(2), text: 'segundo', isCorrect: null, correctPosition: 2 },
        { id: ID(3), text: 'primero', isCorrect: null, correctPosition: 1 },
      ],
    });
    expect(form.steps).toEqual(['primero', 'segundo']);
    expect(form.feedback).toBe('f');
  });

  it('lee la respuesta de verdadero o falso', () => {
    const form = toQuestionForm({
      id: ID(1),
      sortOrder: 1,
      type: 'vf',
      prompt: 'p',
      feedback: null,
      trueFalseAnswer: false,
      options: [],
    });
    expect(form.trueFalseAnswer).toBe(false);
  });
});

describe('isQuestionDirty y changeQuestionType', () => {
  it('una pregunta nueva siempre está pendiente; una guardada solo si cambió', () => {
    const saved = choice({ id: ID(1) });
    expect(isQuestionDirty(null, saved)).toBe(true);
    expect(isQuestionDirty(saved, { ...saved, prompt: '  ¿Cuál es correcta?  ' })).toBe(false);
    expect(isQuestionDirty(saved, { ...saved, prompt: 'Otra' })).toBe(true);
  });

  it('cambiar de tipo conserva enunciado y retroalimentación', () => {
    const changed = changeQuestionType(choice({ feedback: 'Pista' }), 'vf');
    expect(changed.type).toBe('vf');
    expect(changed.prompt).toBe('¿Cuál es correcta?');
    expect(changed.feedback).toBe('Pista');
  });
});

describe('questionCountHint', () => {
  it('recomienda de 4 a 8', () => {
    expect(questionCountHint(5)).toEqual({
      text: '5 preguntas. Recomendamos entre 4 y 8.',
      tone: 'ok',
    });
    expect(questionCountHint(1).tone).toBe('warning');
    expect(questionCountHint(1).text).toContain('1 pregunta.');
    expect(questionCountHint(9).tone).toBe('warning');
  });
});
