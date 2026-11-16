import { SLIDE_KEY_IDEAS_MAX_LENGTH, createSlideSchema, type Slide } from '@gns/shared';

export const SLIDE_TITLE_MAX_LENGTH = 160;

/** Formulario de una diapositiva: título y una idea clave por línea. */
export interface SlideForm {
  /** `null` para una diapositiva nueva. */
  id: string | null;
  title: string;
  keyIdeas: string;
}

export interface SlideFormErrors {
  title?: string;
  keyIdeas?: string;
}

export type SlideResult =
  | { ok: true; input: { title: string | null; keyIdeas: string } }
  | { ok: false; errors: SlideFormErrors };

export function emptySlideForm(): SlideForm {
  return { id: null, title: '', keyIdeas: '' };
}

export function toSlideForm(slide: Slide): SlideForm {
  return { id: slide.id, title: slide.title ?? '', keyIdeas: slide.keyIdeas ?? '' };
}

/** Las ideas clave como lista, sin líneas vacías (para la vista previa). */
export function keyIdeaLines(keyIdeas: string | null): string[] {
  return (keyIdeas ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** Una diapositiva necesita al menos un título o una idea clave. */
export function validateSlideForm(form: SlideForm): SlideResult {
  const title = form.title.trim();
  const keyIdeas = form.keyIdeas.trim();
  const errors: SlideFormErrors = {};
  if (title.length > SLIDE_TITLE_MAX_LENGTH) {
    errors.title = `Escribe como máximo ${SLIDE_TITLE_MAX_LENGTH} caracteres.`;
  }
  if (keyIdeas.length > SLIDE_KEY_IDEAS_MAX_LENGTH) {
    errors.keyIdeas = `Escribe como máximo ${SLIDE_KEY_IDEAS_MAX_LENGTH} caracteres.`;
  }
  if (title === '' && keyIdeas === '') {
    errors.keyIdeas = 'Escribe un título o al menos una idea clave.';
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  const parsed = createSlideSchema.safeParse({ title: title === '' ? null : title, keyIdeas });
  if (!parsed.success) {
    return {
      ok: false,
      errors: { keyIdeas: 'Revisa la diapositiva: hay datos que no se pueden guardar.' },
    };
  }
  return { ok: true, input: parsed.data };
}

/** Una diapositiva nueva siempre está pendiente de guardar; una guardada, solo si cambió. */
export function isSlideDirty(saved: SlideForm | null, draft: SlideForm): boolean {
  return (
    saved === null ||
    saved.title.trim() !== draft.title.trim() ||
    saved.keyIdeas.trim() !== draft.keyIdeas.trim()
  );
}
