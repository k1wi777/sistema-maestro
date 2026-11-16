import { REVIEW_COMMENT_MAX_LENGTH } from '@gns/shared';

import { reviewableBlocks } from './plan-blocks';
import { commentExcess, composeReviewComment, parseReviewComment } from './review-comment';

const BLOCKS = reviewableBlocks('Primaria');

describe('composeReviewComment', () => {
  it('escribe un párrafo por bloque en el orden de la pantalla y la general al final', () => {
    const comment = composeReviewComment(
      BLOCKS,
      { closingMoment: 'Aclara el cierre.', topic: '  Concreta el tema.  ' },
      'Buen trabajo.',
    );
    expect(comment).toBe(
      [
        'Proyecto o tema: Concreta el tema.',
        'Momento 4 · Cierre: Aclara el cierre.',
        'Observación general: Buen trabajo.',
      ].join('\n\n'),
    );
  });

  it('omite lo vacío y una observación de varias líneas no abre párrafos nuevos', () => {
    expect(composeReviewComment(BLOCKS, { topic: '   ' }, '')).toBe('');
    expect(composeReviewComment(BLOCKS, { topic: 'Uno\n\n\nDos' }, '')).toBe(
      'Proyecto o tema: Uno\nDos',
    );
  });

  it('mide cuánto excede el máximo de la API', () => {
    expect(commentExcess('a'.repeat(REVIEW_COMMENT_MAX_LENGTH))).toBe(0);
    expect(commentExcess('a'.repeat(REVIEW_COMMENT_MAX_LENGTH + 7))).toBe(7);
  });
});

describe('parseReviewComment', () => {
  it('es la inversa de componer', () => {
    const observations = {
      developmentMoment: 'Indica el tiempo.',
      resources: 'Lista los materiales.',
    };
    const comment = composeReviewComment(BLOCKS, observations, 'Gracias.\nSigue así.');
    expect(parseReviewComment(comment, BLOCKS)).toEqual({
      blocks: observations,
      general: 'Gracias.\nSigue así.',
    });
  });

  it('un comentario sin estructura cuenta como general y null no da nada', () => {
    expect(parseReviewComment('Falta el cierre.', BLOCKS)).toEqual({
      blocks: {},
      general: 'Falta el cierre.',
    });
    expect(parseReviewComment(null, BLOCKS)).toEqual({ blocks: {}, general: '' });
  });
});
