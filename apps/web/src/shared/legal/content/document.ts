import type { PendingValue } from './pending';

/** Fragmento de texto: literal o dato pendiente de confirmar. */
export type Inline = string | PendingValue;

export type LegalBlock =
  | { readonly type: 'paragraph'; readonly content: readonly Inline[] }
  | { readonly type: 'list'; readonly items: readonly (readonly Inline[])[] }
  | { readonly type: 'link'; readonly label: string; readonly href: string };

export interface LegalSection {
  /** Identificador estable para el índice y los anclajes. */
  readonly id: string;
  readonly heading: string;
  readonly blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  readonly title: string;
  readonly summary: string;
  readonly sections: readonly LegalSection[];
}

/** Constructores que mantienen los textos legibles como datos. */
export const paragraph = (...content: Inline[]): LegalBlock => ({ type: 'paragraph', content });
export const list = (...items: (Inline | readonly Inline[])[]): LegalBlock => ({
  type: 'list',
  items: items.map((item) => (typeof item === 'string' || 'kind' in item ? [item] : item)),
});
export const link = (label: string, href: string): LegalBlock => ({ type: 'link', label, href });
