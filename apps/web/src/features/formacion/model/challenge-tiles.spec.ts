import type { ChallengeQuestionPayload } from '@gns/shared';

import { challengeTiles, isSameAnswer, orderedTexts } from './challenge-tiles';
import { uuid } from './test-fixtures';

const question = (type: ChallengeQuestionPayload['type'], count = 4): ChallengeQuestionPayload => ({
  id: uuid(50),
  type,
  prompt: 'Pregunta',
  seconds: 20,
  options: Array.from({ length: count }, (_, index) => ({
    id: uuid(index + 1),
    text: `Opción ${index + 1}`,
  })),
});

describe('challengeTiles', () => {
  it('assigns red, blue, yellow and green with their shapes in arrival order', () => {
    const tiles = challengeTiles(question('opcion'));

    expect(tiles.map((tile) => [tile.color, tile.shape])).toEqual([
      ['red', 'triangle'],
      ['blue', 'diamond'],
      ['yellow', 'circle'],
      ['green', 'square'],
    ]);
    expect(tiles[2]?.answer).toEqual({ optionId: uuid(3) });
  });

  it('uses two tiles for true or false, even without options', () => {
    const tiles = challengeTiles({ ...question('vf'), options: undefined });

    expect(tiles.map((tile) => tile.label)).toEqual(['Verdadero', 'Falso']);
    expect(tiles.map((tile) => tile.answer)).toEqual([{ value: true }, { value: false }]);
  });

  it('has no tiles for ordering questions', () => {
    expect(challengeTiles(question('orden', 5))).toEqual([]);
  });
});

describe('isSameAnswer', () => {
  it('compares option ids and boolean values and never matches null', () => {
    expect(isSameAnswer({ optionId: uuid(1) }, { optionId: uuid(1) })).toBe(true);
    expect(isSameAnswer({ optionId: uuid(1) }, { optionId: uuid(2) })).toBe(false);
    expect(isSameAnswer({ value: false }, { value: false })).toBe(true);
    expect(isSameAnswer({ value: true }, { optionId: uuid(1) })).toBe(false);
    expect(isSameAnswer(null, { value: true })).toBe(false);
  });
});

describe('orderedTexts', () => {
  it('maps the correct order to the option texts', () => {
    expect(orderedTexts(question('orden', 3), { optionIds: [uuid(3), uuid(1), uuid(2)] })).toEqual([
      'Opción 3',
      'Opción 1',
      'Opción 2',
    ]);
    expect(orderedTexts(question('orden', 3), { value: true })).toEqual([]);
  });
});
