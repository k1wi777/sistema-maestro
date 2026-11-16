import { REVIEW_COMMENT_MAX_LENGTH } from '@gns/shared';

import type { BlockKey, PlanBlock } from './plan-blocks';

/** Rótulo del párrafo que cierra el comentario con la observación general. */
export const GENERAL_LABEL = 'Observación general';

/** Observaciones escritas por bloque (el texto sin recortar, tal como se escribe). */
export type BlockObservations = Partial<Record<BlockKey, string>>;

/** Un salto de línea dentro de una observación; los párrafos se separan con una línea en blanco. */
const clean = (text: string): string => text.trim().replace(/\n\s*\n+/gu, '\n');

/**
 * Comentario único que viaja a la API: un párrafo «<bloque>: <texto>» por bloque observado, en el
 * orden de `blocks`, y al final «Observación general: <texto>», separados por una línea en blanco.
 * La API guarda un solo comentario; así el docente lo lee estructurado sin cambios en su vista.
 */
export function composeReviewComment(
  blocks: readonly PlanBlock[],
  observations: BlockObservations,
  general: string,
): string {
  const paragraphs: string[] = [];
  for (const block of blocks) {
    const text = clean(observations[block.key] ?? '');
    if (text) {
      paragraphs.push(`${block.label}: ${text}`);
    }
  }
  const overall = clean(general);
  if (overall) {
    paragraphs.push(`${GENERAL_LABEL}: ${overall}`);
  }
  return paragraphs.join('\n\n');
}

/** Cuántos caracteres sobran del máximo de la API (0 si cabe). */
export function commentExcess(comment: string): number {
  return Math.max(0, comment.length - REVIEW_COMMENT_MAX_LENGTH);
}

export interface ParsedReviewComment {
  blocks: BlockObservations;
  general: string;
}

/**
 * Inversa de `composeReviewComment`: los párrafos que empiezan por el rótulo de un bloque seguido
 * de «: » son su observación; el resto (también un comentario escrito sin esta estructura, como el
 * de una devolución antigua) cuenta como general.
 */
export function parseReviewComment(
  comment: string | null,
  blocks: readonly PlanBlock[],
): ParsedReviewComment {
  const result: ParsedReviewComment = { blocks: {}, general: '' };
  if (!comment) {
    return result;
  }
  const general: string[] = [];
  for (const paragraph of comment.split(/\n\s*\n/u)) {
    const text = paragraph.trim();
    if (!text) {
      continue;
    }
    if (text.startsWith(`${GENERAL_LABEL}: `)) {
      general.push(text.slice(GENERAL_LABEL.length + 2));
      continue;
    }
    const block = blocks.find((candidate) => text.startsWith(`${candidate.label}: `));
    if (block) {
      result.blocks[block.key] = text.slice(block.label.length + 2);
    } else {
      general.push(text);
    }
  }
  result.general = general.join('\n');
  return result;
}
