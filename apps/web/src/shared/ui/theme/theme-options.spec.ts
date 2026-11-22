import { THEME_OPTIONS } from './theme-options';

describe('opciones del selector de tema', () => {
  it('van en el orden Claro, Oscuro y Sistema, cada una con su icono', () => {
    expect(THEME_OPTIONS.map((option) => [option.value, option.label, option.icon])).toEqual([
      ['light', 'Claro', 'sol'],
      ['dark', 'Oscuro', 'luna'],
      ['system', 'Sistema', 'pantalla'],
    ]);
  });
});
