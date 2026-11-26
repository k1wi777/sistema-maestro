import { createTrainingSectionSchema, type CreateTrainingSectionInput } from '@gns/shared';

export const SECTION_TITLE_MAX_LENGTH = 120;
export const SECTION_SUBTITLE_MAX_LENGTH = 200;

export interface NewSectionValues {
  title: string;
  subtitle: string;
}

export type NewSectionField = keyof NewSectionValues;
export type NewSectionErrors = Partial<Record<NewSectionField, string>>;

export type NewSectionResult =
  { ok: true; input: CreateTrainingSectionInput } | { ok: false; errors: NewSectionErrors };

/** Título para comparar: sin espacios sobrantes ni distinción de mayúsculas (en español). */
function comparable(title: string): string {
  return title.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('es');
}

function tooLong(max: number): string {
  return `Escribe como máximo ${max} caracteres.`;
}

/**
 * Valida el diálogo «Crear nueva sección»: título obligatorio y único en el plan, y subtítulo
 * opcional. La API no exige títulos distintos; dos encabezados iguales confunden, así que la web lo
 * comprueba antes de enviar.
 */
export function validateNewSection(
  values: NewSectionValues,
  existingTitles: readonly string[],
): NewSectionResult {
  const errors: NewSectionErrors = {};
  const title = values.title.trim();
  if (title === '') {
    errors.title = 'Escribe el título de la sección.';
  } else if (title.length > SECTION_TITLE_MAX_LENGTH) {
    errors.title = tooLong(SECTION_TITLE_MAX_LENGTH);
  } else if (existingTitles.some((existing) => comparable(existing) === comparable(title))) {
    errors.title = 'Ya hay una sección con ese título en este plan.';
  }
  if (values.subtitle.trim().length > SECTION_SUBTITLE_MAX_LENGTH) {
    errors.subtitle = tooLong(SECTION_SUBTITLE_MAX_LENGTH);
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  const parsed = createTrainingSectionSchema.safeParse({
    title,
    subtitle: values.subtitle.trim() === '' ? null : values.subtitle.trim(),
  });
  if (!parsed.success) {
    return { ok: false, errors: { title: 'Revisa este campo.' } };
  }
  return { ok: true, input: parsed.data };
}

/** Pasa a errores de campo lo que la API rechazó; lo que no es de un campo va en `other`. */
export function mapSectionApiErrors(errors: { field: string; reason: string }[] | undefined): {
  fields: NewSectionErrors;
  other: string[];
} {
  const fields: NewSectionErrors = {};
  const other: string[] = [];
  for (const { field, reason } of errors ?? []) {
    if (field === 'title' || field === 'subtitle') {
      fields[field] ??= reason.charAt(0).toUpperCase() + reason.slice(1);
    } else {
      other.push(reason);
    }
  }
  return { fields, other };
}
