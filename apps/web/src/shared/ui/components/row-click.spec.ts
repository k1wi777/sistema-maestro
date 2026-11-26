import { rowClickAction, type RowClickInput } from './row-click';

const base: RowClickInput = {
  button: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  onInteractive: false,
  selectedText: '',
};

describe('rowClickAction', () => {
  it('navega con el clic primario', () => {
    expect(rowClickAction(base)).toBe('navigate');
  });

  it('abre una pestaña con Ctrl o Cmd + clic y con el clic central', () => {
    expect(rowClickAction({ ...base, ctrlKey: true })).toBe('new-tab');
    expect(rowClickAction({ ...base, metaKey: true })).toBe('new-tab');
    expect(rowClickAction({ ...base, button: 1 })).toBe('new-tab');
  });

  it('no hace nada si el clic cae en otro control de la fila', () => {
    expect(rowClickAction({ ...base, onInteractive: true })).toBe('none');
    expect(rowClickAction({ ...base, onInteractive: true, ctrlKey: true })).toBe('none');
  });

  it('no hace nada con texto seleccionado', () => {
    expect(rowClickAction({ ...base, selectedText: 'Marcela' })).toBe('none');
    expect(rowClickAction({ ...base, selectedText: '   ' })).toBe('navigate');
  });

  it('ignora el botón secundario y Mayús o Alt', () => {
    expect(rowClickAction({ ...base, button: 2 })).toBe('none');
    expect(rowClickAction({ ...base, shiftKey: true })).toBe('none');
    expect(rowClickAction({ ...base, altKey: true })).toBe('none');
  });
});
