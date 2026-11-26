/** Lo que hay que saber de un clic en una fila para decidir si navega. */
export interface RowClickInput {
  /** `MouseEvent.button`: 0 primario, 1 central. */
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  /** El objetivo del clic está dentro de un control de la fila (enlace, botón, campo…). */
  onInteractive: boolean;
  /** Texto seleccionado en la página (`window.getSelection()?.toString()`). */
  selectedText: string;
}

export type RowClickAction = 'none' | 'navigate' | 'new-tab';

/** Elementos que conservan su propio clic dentro de una fila clicable. */
export const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, label, [role="button"]';

/**
 * Decide qué hace un clic en una fila clicable: clic primario navega; Ctrl/Cmd + clic primario o
 * clic central abre una pestaña nueva; un control de la fila, el texto seleccionado, otros botones
 * del ratón y Mayús/Alt no hacen nada (el enlace «Acción» sigue siendo el control accesible).
 */
export function rowClickAction(input: RowClickInput): RowClickAction {
  if (input.onInteractive || input.selectedText.trim() !== '') return 'none';
  if (input.shiftKey || input.altKey) return 'none';
  if (input.button === 1) return 'new-tab';
  if (input.button !== 0) return 'none';
  return input.ctrlKey || input.metaKey ? 'new-tab' : 'navigate';
}
