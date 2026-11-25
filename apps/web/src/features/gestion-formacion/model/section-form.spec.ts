import { mapSectionApiErrors, validateNewSection } from './section-form';

const none: string[] = [];

describe('validateNewSection', () => {
  it('exige el título', () => {
    expect(validateNewSection({ title: '', subtitle: '' }, none)).toEqual({
      ok: false,
      errors: { title: 'Escribe el título de la sección.' },
    });
    expect(validateNewSection({ title: '   ', subtitle: '' }, none).ok).toBe(false);
  });

  it('admite 120 caracteres de título y rechaza 121', () => {
    expect(validateNewSection({ title: 'a'.repeat(120), subtitle: '' }, none).ok).toBe(true);
    const long = validateNewSection({ title: 'a'.repeat(121), subtitle: '' }, none);
    expect(long.ok === false && long.errors.title).toContain('120');
  });

  it('admite 200 caracteres de subtítulo y rechaza 201', () => {
    expect(validateNewSection({ title: 'x', subtitle: 'b'.repeat(200) }, none).ok).toBe(true);
    const long = validateNewSection({ title: 'x', subtitle: 'b'.repeat(201) }, none);
    expect(long.ok === false && long.errors.subtitle).toContain('200');
  });

  it('rechaza un título repetido sin distinguir mayúsculas ni espacios sobrantes', () => {
    const result = validateNewSection({ title: '  parte  II ', subtitle: '' }, ['Parte II']);
    expect(result.ok === false && result.errors.title).toContain('Ya hay una sección');
  });

  it('arma el cuerpo con el título recortado y el subtítulo vacío como null', () => {
    expect(validateNewSection({ title: ' Práctica ', subtitle: ' ' }, ['Otra'])).toEqual({
      ok: true,
      input: { title: 'Práctica', subtitle: null },
    });
    expect(validateNewSection({ title: 'Práctica', subtitle: ' Para aplicar ' }, none)).toEqual({
      ok: true,
      input: { title: 'Práctica', subtitle: 'Para aplicar' },
    });
  });
});

describe('mapSectionApiErrors', () => {
  it('separa los errores de campo de los demás', () => {
    expect(
      mapSectionApiErrors([
        { field: 'title', reason: 'no puede estar vacío' },
        { field: 'otro', reason: 'algo' },
      ]),
    ).toEqual({ fields: { title: 'No puede estar vacío' }, other: ['algo'] });
  });
});
