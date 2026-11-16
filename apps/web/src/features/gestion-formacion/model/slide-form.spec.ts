import {
  emptySlideForm,
  isSlideDirty,
  keyIdeaLines,
  toSlideForm,
  validateSlideForm,
} from './slide-form';
import { ID } from './test-fixtures';

describe('validateSlideForm', () => {
  it('exige un título o al menos una idea clave', () => {
    const result = validateSlideForm(emptySlideForm());
    expect(result).toEqual({
      ok: false,
      errors: { keyIdeas: 'Escribe un título o al menos una idea clave.' },
    });
  });

  it('con solo título o solo ideas es válida; el título vacío viaja como null', () => {
    expect(validateSlideForm({ id: null, title: ' Hola ', keyIdeas: '' })).toEqual({
      ok: true,
      input: { title: 'Hola', keyIdeas: '' },
    });
    expect(validateSlideForm({ id: null, title: '', keyIdeas: ' uno\ndos ' })).toEqual({
      ok: true,
      input: { title: null, keyIdeas: 'uno\ndos' },
    });
  });

  it('respeta los máximos', () => {
    const result = validateSlideForm({
      id: null,
      title: 'a'.repeat(161),
      keyIdeas: 'b'.repeat(2001),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.title).toContain('160');
      expect(result.errors.keyIdeas).toContain('2000');
    }
  });
});

describe('toSlideForm, isSlideDirty y keyIdeaLines', () => {
  const slide = { id: ID(1), sortOrder: 1, title: null, keyIdeas: 'uno\n\n dos ' };

  it('convierte los nulos en texto vacío', () => {
    expect(toSlideForm(slide)).toEqual({ id: ID(1), title: '', keyIdeas: 'uno\n\n dos ' });
  });

  it('detecta cambios ignorando espacios de los extremos', () => {
    const saved = toSlideForm(slide);
    expect(isSlideDirty(null, saved)).toBe(true);
    expect(isSlideDirty(saved, { ...saved, keyIdeas: ' uno\n\n dos' })).toBe(false);
    expect(isSlideDirty(saved, { ...saved, title: 'Nuevo' })).toBe(true);
  });

  it('separa las ideas por línea sin líneas vacías', () => {
    expect(keyIdeaLines(slide.keyIdeas)).toEqual(['uno', 'dos']);
    expect(keyIdeaLines(null)).toEqual([]);
  });
});
