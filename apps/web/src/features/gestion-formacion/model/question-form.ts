import {
  ChallengeQuestionType,
  QUESTION_OPTIONS_LIMITS,
  QUESTION_ORDER_STEPS_LIMITS,
  challengeQuestionInputSchema,
  type ChallengeQuestion,
  type ChallengeQuestionInput,
} from '@gns/shared';

export const QUESTION_PROMPT_MAX_LENGTH = 500;
export const QUESTION_FEEDBACK_MAX_LENGTH = 500;
export const QUESTION_ITEM_MAX_LENGTH = 200;

/** Cantidad de preguntas que se recomienda para un Desafío. */
export const RECOMMENDED_QUESTIONS = { min: 4, max: 8 } as const;

export interface OptionForm {
  text: string;
  isCorrect: boolean;
}

/** Estado del formulario de una pregunta; solo cuentan los campos del tipo elegido. */
export interface QuestionForm {
  /** `null` para una pregunta nueva. */
  id: string | null;
  type: ChallengeQuestionType;
  prompt: string;
  feedback: string;
  options: OptionForm[];
  trueFalseAnswer: boolean;
  /** Pasos en el orden correcto. */
  steps: string[];
}

export function emptyQuestionForm(
  type: ChallengeQuestionType = ChallengeQuestionType.MultipleChoice,
): QuestionForm {
  return {
    id: null,
    type,
    prompt: '',
    feedback: '',
    options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
    ],
    trueFalseAnswer: true,
    steps: ['', ''],
  };
}

/** Cambia el tipo conservando enunciado y retroalimentación; lo propio de cada tipo se conserva. */
export function changeQuestionType(form: QuestionForm, type: ChallengeQuestionType): QuestionForm {
  return { ...form, type };
}

/** La pregunta guardada como formulario: la opción correcta por `isCorrect`, los pasos por posición. */
export function toQuestionForm(question: ChallengeQuestion): QuestionForm {
  const base = { ...emptyQuestionForm(question.type), id: question.id };
  const common = { ...base, prompt: question.prompt, feedback: question.feedback ?? '' };
  switch (question.type) {
    case ChallengeQuestionType.MultipleChoice:
      return {
        ...common,
        options: question.options.map((option) => ({
          text: option.text,
          isCorrect: option.isCorrect === true,
        })),
      };
    case ChallengeQuestionType.TrueFalse:
      return { ...common, trueFalseAnswer: question.trueFalseAnswer === true };
    case ChallengeQuestionType.Ordering:
      return {
        ...common,
        steps: [...question.options]
          .sort((a, b) => (a.correctPosition ?? 0) - (b.correctPosition ?? 0))
          .map((option) => option.text),
      };
  }
}

export interface QuestionFormErrors {
  prompt?: string;
  feedback?: string;
  /** Error de la lista de opciones (por ejemplo, ninguna correcta). */
  options?: string;
  optionTexts: Record<number, string>;
  steps?: string;
  stepTexts: Record<number, string>;
}

export type QuestionResult =
  { ok: true; input: ChallengeQuestionInput } | { ok: false; errors: QuestionFormErrors };

const REQUIRED_TEXT = 'Escríbelo antes de guardar.';

function tooLong(max: number): string {
  return `Escribe como máximo ${max} caracteres.`;
}

/** Valida con mensajes en español y, si pasa, con el esquema compartido; devuelve el cuerpo de la API. */
export function validateQuestionForm(form: QuestionForm): QuestionResult {
  const errors: QuestionFormErrors = { optionTexts: {}, stepTexts: {} };
  const prompt = form.prompt.trim();
  const feedback = form.feedback.trim();

  if (prompt === '') {
    errors.prompt = 'Escribe la pregunta.';
  } else if (prompt.length > QUESTION_PROMPT_MAX_LENGTH) {
    errors.prompt = tooLong(QUESTION_PROMPT_MAX_LENGTH);
  }
  if (feedback.length > QUESTION_FEEDBACK_MAX_LENGTH) {
    errors.feedback = tooLong(QUESTION_FEEDBACK_MAX_LENGTH);
  }

  if (form.type === ChallengeQuestionType.MultipleChoice) {
    const { min, max } = QUESTION_OPTIONS_LIMITS;
    if (form.options.length < min || form.options.length > max) {
      errors.options = `Usa entre ${min} y ${max} opciones.`;
    } else if (form.options.filter((option) => option.isCorrect).length !== 1) {
      errors.options = 'Marca exactamente una opción correcta.';
    }
    form.options.forEach((option, index) => {
      const text = option.text.trim();
      if (text === '') {
        errors.optionTexts[index] = REQUIRED_TEXT;
      } else if (text.length > QUESTION_ITEM_MAX_LENGTH) {
        errors.optionTexts[index] = tooLong(QUESTION_ITEM_MAX_LENGTH);
      }
    });
  }
  if (form.type === ChallengeQuestionType.Ordering) {
    const { min, max } = QUESTION_ORDER_STEPS_LIMITS;
    if (form.steps.length < min || form.steps.length > max) {
      errors.steps = `Usa entre ${min} y ${max} pasos.`;
    }
    form.steps.forEach((step, index) => {
      const text = step.trim();
      if (text === '') {
        errors.stepTexts[index] = REQUIRED_TEXT;
      } else if (text.length > QUESTION_ITEM_MAX_LENGTH) {
        errors.stepTexts[index] = tooLong(QUESTION_ITEM_MAX_LENGTH);
      }
    });
  }

  const hasErrors =
    errors.prompt !== undefined ||
    errors.feedback !== undefined ||
    errors.options !== undefined ||
    errors.steps !== undefined ||
    Object.keys(errors.optionTexts).length > 0 ||
    Object.keys(errors.stepTexts).length > 0;
  if (hasErrors) {
    return { ok: false, errors };
  }

  const common = { prompt, feedback: feedback === '' ? null : feedback };
  const candidate = (() => {
    switch (form.type) {
      case ChallengeQuestionType.MultipleChoice:
        return {
          type: form.type,
          ...common,
          options: form.options.map((option) => ({
            text: option.text.trim(),
            isCorrect: option.isCorrect,
          })),
        };
      case ChallengeQuestionType.TrueFalse:
        return { type: form.type, ...common, trueFalseAnswer: form.trueFalseAnswer };
      case ChallengeQuestionType.Ordering:
        return { type: form.type, ...common, steps: form.steps.map((step) => step.trim()) };
    }
  })();
  const parsed = challengeQuestionInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      errors: { ...errors, prompt: 'Revisa la pregunta: hay datos que no se pueden guardar.' },
    };
  }
  return { ok: true, input: parsed.data };
}

/** Texto del formulario sin espacios sobrantes, para saber si cambió respecto de lo guardado. */
function fingerprint(form: QuestionForm): string {
  const base = { type: form.type, prompt: form.prompt.trim(), feedback: form.feedback.trim() };
  switch (form.type) {
    case ChallengeQuestionType.MultipleChoice:
      return JSON.stringify({
        ...base,
        options: form.options.map((option) => [option.text.trim(), option.isCorrect]),
      });
    case ChallengeQuestionType.TrueFalse:
      return JSON.stringify({ ...base, answer: form.trueFalseAnswer });
    case ChallengeQuestionType.Ordering:
      return JSON.stringify({ ...base, steps: form.steps.map((step) => step.trim()) });
  }
}

/** Una pregunta nueva siempre está pendiente de guardar; una guardada, solo si cambió. */
export function isQuestionDirty(saved: QuestionForm | null, draft: QuestionForm): boolean {
  return saved === null || fingerprint(saved) !== fingerprint(draft);
}

/** Cuántas preguntas hay y si el número está dentro de lo recomendado. */
export function questionCountHint(count: number): { text: string; tone: 'ok' | 'warning' } {
  const noun = count === 1 ? '1 pregunta' : `${count} preguntas`;
  const { min, max } = RECOMMENDED_QUESTIONS;
  const within = count >= min && count <= max;
  return {
    text: `${noun}. Recomendamos entre ${min} y ${max}.`,
    tone: within ? 'ok' : 'warning',
  };
}
