import { wheelSegments } from './wheel';

const cards = (n: number) => Array.from({ length: n }, (_, i) => ({ clave: `k${i}` }));

describe('wheelSegments', () => {
  it('splits the circle equally with one segment per card', () => {
    const segments = wheelSegments(cards(4));

    expect(segments.map((s) => [s.start, s.end, s.center])).toEqual([
      [0, 90, 45],
      [90, 180, 135],
      [180, 270, 225],
      [270, 360, 315],
    ]);
    expect(segments.map((s) => s.color)).toEqual(['red', 'blue', 'yellow', 'green']);
  });

  it('never gives the same color to circular neighbours', () => {
    for (let n = 2; n <= 20; n += 1) {
      const colors = wheelSegments(cards(n)).map((s) => s.color);
      colors.forEach((color, index) => {
        expect(color).not.toBe(colors[(index + 1) % n]);
      });
    }
  });

  it('handles no cards', () => {
    expect(wheelSegments([])).toEqual([]);
  });
});
