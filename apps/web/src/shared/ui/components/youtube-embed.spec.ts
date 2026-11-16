import { youTubeEmbedSrc } from './youtube-embed';

const ID = 'LAj4tbIR0J4';
const BASE = `https://www.youtube-nocookie.com/embed/${ID}`;

describe('youTubeEmbedSrc', () => {
  it('conserva una dirección de inserción válida, con y sin inicio', () => {
    expect(youTubeEmbedSrc(BASE, null)).toBe(BASE);
    expect(youTubeEmbedSrc(`${BASE}?start=30`, null)).toBe(`${BASE}?start=30`);
  });

  it('usa videoUrl cuando no hay dirección de inserción', () => {
    expect(youTubeEmbedSrc(null, `https://youtu.be/${ID}`)).toBe(BASE);
    expect(youTubeEmbedSrc(null, `https://www.youtube.com/watch?v=${ID}&t=1m30s`)).toBe(
      `${BASE}?start=90`,
    );
    expect(youTubeEmbedSrc(undefined, `https://www.youtube.com/shorts/${ID}`)).toBe(BASE);
  });

  it('devuelve null si no hay enlace o no se puede interpretar', () => {
    expect(youTubeEmbedSrc(null, null)).toBeNull();
    expect(youTubeEmbedSrc('', '')).toBeNull();
    expect(youTubeEmbedSrc(null, 'no es un enlace')).toBeNull();
    expect(youTubeEmbedSrc(null, `http://youtu.be/${ID}`)).toBeNull();
    expect(youTubeEmbedSrc(null, `https://vimeo.com/${ID}`)).toBeNull();
    expect(youTubeEmbedSrc(null, 'https://youtu.be/corto')).toBeNull();
    expect(youTubeEmbedSrc('https://evil.example/embed/LAj4tbIR0J4', null)).toBeNull();
  });

  it('reconstruye siempre el host sin cookies y nunca añade autoplay', () => {
    const result = youTubeEmbedSrc(`https://www.youtube.com/embed/${ID}?autoplay=1&start=10`, null);
    expect(result).toBe(`${BASE}?start=10`);
    expect(new URL(result as string).hostname).toBe('www.youtube-nocookie.com');
    expect(result).not.toContain('autoplay');
  });
});
