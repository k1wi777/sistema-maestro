import {
  CHALLENGE_SECONDS_PER_QUESTION_LIMITS,
  createTrainingModuleSchema,
  parseYouTubeUrl,
  updateTrainingModuleSchema,
  type CreateTrainingModuleInput,
  type TrainingModule,
  type UpdateTrainingModuleInput,
} from '@gns/shared';

/** Campos del módulo que se editan como texto (todos viajan como texto; `''` = vacío). */
export const MODULE_FORM_FIELDS = [
  'number',
  'title',
  'summary',
  'sectionId',
  'approvalThreshold',
  'secondsPerQuestion',
  'videoUrl',
  'videoTitle',
  'presentationUrl',
] as const;
export type ModuleFormField = (typeof MODULE_FORM_FIELDS)[number];
export type ModuleFormValues = Record<ModuleFormField, string>;
export type ModuleFormErrors = Partial<Record<ModuleFormField, string>>;

/** Campos que guarda cada paso del editor que escribe en el módulo. */
export const DATA_STEP_FIELDS: readonly ModuleFormField[] = [
  'number',
  'title',
  'summary',
  'sectionId',
  'approvalThreshold',
  'secondsPerQuestion',
];
export const VIDEO_STEP_FIELDS: readonly ModuleFormField[] = ['videoUrl', 'videoTitle'];
export const PRESENTATION_STEP_FIELDS: readonly ModuleFormField[] = ['presentationUrl'];

export const MODULE_FIELD_MAX_LENGTH = {
  number: 4,
  title: 160,
  summary: 500,
  videoTitle: 160,
  url: 500,
} as const;

export function toModuleFormValues(
  module: Pick<
    TrainingModule,
    | 'number'
    | 'title'
    | 'summary'
    | 'sectionId'
    | 'approvalThreshold'
    | 'secondsPerQuestion'
    | 'videoUrl'
    | 'videoTitle'
    | 'presentationUrl'
  >,
): ModuleFormValues {
  return {
    number: module.number ?? '',
    title: module.title,
    summary: module.summary ?? '',
    sectionId: module.sectionId,
    approvalThreshold: String(module.approvalThreshold),
    secondsPerQuestion: module.secondsPerQuestion === null ? '' : String(module.secondsPerQuestion),
    videoUrl: module.videoUrl ?? '',
    videoTitle: module.videoTitle ?? '',
    presentationUrl: module.presentationUrl ?? '',
  };
}

function normalize(value: string): string {
  return value.trim();
}

/** Campos (de `fields`) cuyo valor normalizado difiere entre lo guardado y el borrador. */
export function dirtyModuleFields(
  saved: ModuleFormValues,
  draft: ModuleFormValues,
  fields: readonly ModuleFormField[],
): ModuleFormField[] {
  return fields.filter((field) => normalize(saved[field]) !== normalize(draft[field]));
}

const PERCENT_ERROR = 'Escribe un porcentaje entero entre 0 y 100.';
const SECONDS_ERROR = `Escribe segundos enteros entre ${CHALLENGE_SECONDS_PER_QUESTION_LIMITS.min} y ${CHALLENGE_SECONDS_PER_QUESTION_LIMITS.max}, o déjalo vacío para usar el tiempo de cada tipo.`;

function integerOf(text: string): number | null {
  return /^\d+$/.test(text) ? Number(text) : null;
}

function tooLong(max: number): string {
  return `Escribe como máximo ${max} caracteres.`;
}

function isHttpsUrl(text: string): boolean {
  try {
    return new URL(text).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Valida un campo con mensajes en español; `null` si es válido. */
function fieldError(field: ModuleFormField, raw: string): string | null {
  const text = normalize(raw);
  switch (field) {
    case 'number':
      return text.length > MODULE_FIELD_MAX_LENGTH.number
        ? tooLong(MODULE_FIELD_MAX_LENGTH.number)
        : null;
    case 'title':
      if (text === '') {
        return 'Escribe el título del módulo.';
      }
      return text.length > MODULE_FIELD_MAX_LENGTH.title
        ? tooLong(MODULE_FIELD_MAX_LENGTH.title)
        : null;
    case 'summary':
      return text.length > MODULE_FIELD_MAX_LENGTH.summary
        ? tooLong(MODULE_FIELD_MAX_LENGTH.summary)
        : null;
    case 'sectionId':
      return text === '' ? 'Elige la sección del plan.' : null;
    case 'approvalThreshold': {
      const value = integerOf(text);
      return value === null || value > 100 ? PERCENT_ERROR : null;
    }
    case 'secondsPerQuestion': {
      if (text === '') {
        return null;
      }
      const value = integerOf(text);
      const { min, max } = CHALLENGE_SECONDS_PER_QUESTION_LIMITS;
      return value === null || value < min || value > max ? SECONDS_ERROR : null;
    }
    case 'videoUrl':
      if (text === '') {
        return null;
      }
      if (text.length > MODULE_FIELD_MAX_LENGTH.url) {
        return tooLong(MODULE_FIELD_MAX_LENGTH.url);
      }
      return parseYouTubeUrl(text) === null
        ? 'Escribe un enlace de YouTube (youtube.com o youtu.be).'
        : null;
    case 'videoTitle':
      return text.length > MODULE_FIELD_MAX_LENGTH.videoTitle
        ? tooLong(MODULE_FIELD_MAX_LENGTH.videoTitle)
        : null;
    case 'presentationUrl':
      if (text === '') {
        return null;
      }
      if (text.length > MODULE_FIELD_MAX_LENGTH.url) {
        return tooLong(MODULE_FIELD_MAX_LENGTH.url);
      }
      return isHttpsUrl(text) ? null : 'Escribe un enlace que empiece por https://.';
  }
}

function toBodyValue(field: ModuleFormField, raw: string): string | number | null {
  const text = normalize(raw);
  switch (field) {
    case 'approvalThreshold':
      return Number(text);
    case 'secondsPerQuestion':
      return text === '' ? null : Number(text);
    case 'title':
    case 'sectionId':
      return text;
    default:
      return text === '' ? null : text;
  }
}

export type ModulePatchResult =
  | { kind: 'unchanged' }
  | { kind: 'invalid'; errors: ModuleFormErrors }
  | { kind: 'patch'; body: UpdateTrainingModuleInput; fields: ModuleFormField[] };

const FALLBACK_ERROR = 'Revisa este campo.';

/**
 * Cuerpo del `PATCH` con solo los campos modificados de `fields`. Valida primero con mensajes en
 * español y luego con el esquema compartido, que decide en última instancia.
 */
export function buildModulePatch(
  saved: ModuleFormValues,
  draft: ModuleFormValues,
  fields: readonly ModuleFormField[],
): ModulePatchResult {
  const changed = dirtyModuleFields(saved, draft, fields);
  if (changed.length === 0) {
    return { kind: 'unchanged' };
  }
  const errors: ModuleFormErrors = {};
  for (const field of changed) {
    const message = fieldError(field, draft[field]);
    if (message) {
      errors[field] = message;
    }
  }
  if (Object.keys(errors).length > 0) {
    return { kind: 'invalid', errors };
  }
  const candidate: Record<string, string | number | null> = {};
  for (const field of changed) {
    candidate[field] = toBodyValue(field, draft[field]);
  }
  const parsed = updateTrainingModuleSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '');
      if ((changed as string[]).includes(field)) {
        errors[field as ModuleFormField] ??= FALLBACK_ERROR;
      }
    }
    return {
      kind: 'invalid',
      errors: Object.keys(errors).length > 0 ? errors : { title: FALLBACK_ERROR },
    };
  }
  return { kind: 'patch', body: parsed.data, fields: changed };
}

/** Pasa a errores de campo lo que la API rechazó (`errors` del cuerpo 400). */
export function mapModuleApiErrors(errors: { field: string; reason: string }[] | undefined): {
  fields: ModuleFormErrors;
  other: string[];
} {
  const fields: ModuleFormErrors = {};
  const other: string[] = [];
  for (const { field, reason } of errors ?? []) {
    const known = (MODULE_FORM_FIELDS as readonly string[]).includes(field);
    if (known) {
      fields[field as ModuleFormField] ??= reason.charAt(0).toUpperCase() + reason.slice(1);
    } else {
      other.push(reason);
    }
  }
  return { fields, other };
}

// ---------- Módulo nuevo ----------

export interface NewModuleValues {
  number: string;
  title: string;
}

export type NewModuleErrors = Partial<Record<keyof NewModuleValues, string>>;

export type NewModuleResult =
  { ok: true; input: CreateTrainingModuleInput } | { ok: false; errors: NewModuleErrors };

/** Número y título: lo único que pide «Nuevo módulo» (la sección ya viene fijada). */
export function validateNewModule(values: NewModuleValues): NewModuleResult {
  const errors: NewModuleErrors = {};
  if (normalize(values.number) === '') {
    errors.number = 'Escribe el número del módulo.';
  } else {
    const message = fieldError('number', values.number);
    if (message) {
      errors.number = message;
    }
  }
  const titleError = fieldError('title', values.title);
  if (titleError) {
    errors.title = titleError;
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  const parsed = createTrainingModuleSchema.safeParse({
    number: normalize(values.number),
    title: normalize(values.title),
  });
  if (!parsed.success) {
    return { ok: false, errors: { title: FALLBACK_ERROR } };
  }
  return { ok: true, input: parsed.data };
}

/** Siguiente número sugerido: el mayor número entero de los módulos más uno (1 si no hay). */
export function suggestNextNumber(numbers: readonly (string | null)[]): string {
  let highest = 0;
  for (const number of numbers) {
    const value = number === null ? null : integerOf(number.trim());
    if (value !== null && value > highest) {
      highest = value;
    }
  }
  return String(highest + 1);
}
