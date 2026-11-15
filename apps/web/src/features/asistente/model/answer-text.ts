/** Fragmento de una línea: texto normal o en negrita. */
export interface Inline {
  text: string;
  bold: boolean;
}

export type AnswerBlock =
  { kind: 'paragraph'; parts: Inline[] } | { kind: 'list'; items: Inline[][] };

const BOLD = /\*\*(.+?)\*\*/gu;
const BULLET = /^[-•]\s+/u;

/** Parte una línea en fragmentos normales y en negrita (`**texto**`); un `**` sin pareja queda tal cual. */
export function parseInline(line: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  for (const match of line.matchAll(BOLD)) {
    const start = match.index ?? 0;
    if (start > last) {
      parts.push({ text: line.slice(last, start), bold: false });
    }
    parts.push({ text: match[1] ?? '', bold: true });
    last = start + match[0].length;
  }
  if (last < line.length) {
    parts.push({ text: line.slice(last), bold: false });
  }
  return parts;
}

/**
 * Respuesta programada como bloques: párrafos y listas con viñetas (`- `), con negrita en línea.
 * Es un subconjunto mínimo de lo que traen las respuestas del asistente y solo produce texto:
 * nunca HTML, enlaces ni imágenes, de modo que React escapa todo el contenido.
 */
export function parseAnswerText(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '') {
      continue;
    }
    if (BULLET.test(line)) {
      const item = parseInline(line.replace(BULLET, ''));
      const previous = blocks[blocks.length - 1];
      if (previous?.kind === 'list') {
        previous.items.push(item);
      } else {
        blocks.push({ kind: 'list', items: [item] });
      }
    } else {
      blocks.push({ kind: 'paragraph', parts: parseInline(line) });
    }
  }
  return blocks;
}
