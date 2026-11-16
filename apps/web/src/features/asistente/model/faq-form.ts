import {
  FAQ_QUESTION_MAX_LENGTH,
  createFaqSchema,
  updateFaqSchema,
  type CreateFaqInput,
  type FaqAdminView,
  type UpdateFaqInput,
} from '@gns/shared';

export interface FaqFormValues {
  category: string;
  question: string;
  answer: string;
  keywords: string;
  source: string;
}

export type FaqFormField = keyof FaqFormValues;
export type FaqFormErrors = Partial<Record<FaqFormField, string>>;

export const EMPTY_FAQ_FORM: FaqFormValues = {
  category: '',
  question: '',
  answer: '',
  keywords: '',
  source: '',
};

const FIELDS: readonly string[] = ['category', 'question', 'answer', 'keywords', 'source'];

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

interface Issues {
  issues: { path: PropertyKey[]; message: string }[];
}

function errorsOf(error: Issues): FaqFormErrors {
  const errors: FaqFormErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '');
    if (FIELDS.includes(field) && !errors[field as FaqFormField]) {
      errors[field as FaqFormField] = capitalize(issue.message);
    }
  }
  return errors;
}

/** Pasa a error de campo lo que la API rechazó (`errors` del cuerpo 400). */
export function apiFaqFieldErrors(
  errors: { field: string; reason: string }[] | undefined,
): FaqFormErrors {
  const result: FaqFormErrors = {};
  for (const { field, reason } of errors ?? []) {
    if (FIELDS.includes(field) && !result[field as FaqFormField]) {
      result[field as FaqFormField] = capitalize(reason);
    }
  }
  return result;
}

/** Valores iniciales: los de la pregunta que se edita o, al crear, el texto de la pregunta sin respuesta. */
export function initialFaqForm(faq: FaqAdminView | null, prefillQuestion?: string): FaqFormValues {
  if (faq) {
    return {
      category: faq.category,
      question: faq.question,
      answer: faq.answer,
      keywords: faq.keywords ?? '',
      source: faq.source ?? '',
    };
  }
  return { ...EMPTY_FAQ_FORM, question: (prefillQuestion ?? '').slice(0, FAQ_QUESTION_MAX_LENGTH) };
}

export type FaqCreateResult =
  { ok: true; input: CreateFaqInput } | { ok: false; errors: FaqFormErrors };

/** Valida el alta con el esquema compartido; los opcionales vacíos no se envían. */
export function validateFaqCreate(
  values: FaqFormValues,
  unansweredQuestionId?: string,
): FaqCreateResult {
  const parsed = createFaqSchema.safeParse({
    category: values.category === '' ? undefined : values.category,
    question: values.question,
    answer: values.answer,
    ...(values.keywords.trim() ? { keywords: values.keywords } : {}),
    ...(values.source.trim() ? { source: values.source } : {}),
    ...(unansweredQuestionId ? { unansweredQuestionId } : {}),
  });
  if (parsed.success) {
    return { ok: true, input: parsed.data };
  }
  const errors = errorsOf(parsed.error);
  if (values.category === '') {
    errors.category = 'Elige una categoría.';
  }
  return { ok: false, errors };
}

export type FaqUpdateResult =
  { ok: true; input: UpdateFaqInput } | { ok: false; errors: FaqFormErrors; unchanged: boolean };

const CANNOT_CLEAR = 'Una vez guardado, este campo no se puede dejar vacío.';

/** Valida la edición y envía solo los campos que cambiaron. */
export function validateFaqUpdate(values: FaqFormValues, original: FaqAdminView): FaqUpdateResult {
  const changes: Record<string, string> = {};
  const errors: FaqFormErrors = {};
  const pairs: [FaqFormField, string, string][] = [
    ['category', values.category, original.category],
    ['question', values.question, original.question],
    ['answer', values.answer, original.answer],
    ['keywords', values.keywords, original.keywords ?? ''],
    ['source', values.source, original.source ?? ''],
  ];
  for (const [field, value, before] of pairs) {
    if (value.trim() === before.trim()) {
      continue;
    }
    // La API no admite vaciar las palabras clave ni la fuente una vez guardadas.
    if (value.trim() === '' && (field === 'keywords' || field === 'source')) {
      errors[field] = CANNOT_CLEAR;
      continue;
    }
    changes[field] = value;
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, unchanged: false };
  }
  if (Object.keys(changes).length === 0) {
    return { ok: false, errors: {}, unchanged: true };
  }
  const parsed = updateFaqSchema.safeParse(changes);
  return parsed.success
    ? { ok: true, input: parsed.data }
    : { ok: false, errors: errorsOf(parsed.error), unchanged: false };
}
