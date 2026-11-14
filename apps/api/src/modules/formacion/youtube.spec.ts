import {
  createTrainingModuleSchema,
  parseYouTubeUrl,
  toYouTubeEmbedUrl,
  updateTrainingModuleSchema,
} from '@gns/shared';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTubeUrl', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}&feature=share`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/embed/${ID}/`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://youtube-nocookie.com/embed/${ID}`,
    `https://WWW.YouTube.com/watch?v=${ID}`,
  ])('accepts %s', (url) => {
    expect(parseYouTubeUrl(url)).toEqual({ id: ID, startSeconds: 0 });
  });

  it.each([
    `http://youtu.be/${ID}`,
    `https://vimeo.com/${ID}`,
    `https://evil.com/watch?v=${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
    `https://notyoutube.com/watch?v=${ID}`,
    `https://youtu.be.evil.com/${ID}`,
    `https://user:pass@youtu.be/${ID}`,
    `https://youtu.be:8443/${ID}`,
    `https://www.youtube.com/watch?v=corto`,
    `https://www.youtube.com/watch?v=${ID}extra`,
    `https://www.youtube.com/watch`,
    `https://www.youtube.com/playlist?list=${ID}`,
    `https://www.youtube.com/embed/${ID}/mas`,
    `https://youtu.be/`,
    `https://youtu.be/${ID}/extra`,
    `https://www.youtube-nocookie.com/watch?v=${ID}`,
    'javascript:alert(1)',
    'no es una url',
    '',
  ])('rejects %s', (url) => {
    expect(parseYouTubeUrl(url)).toBeNull();
  });

  it.each([
    [`https://youtu.be/${ID}?t=90`, 90],
    [`https://youtu.be/${ID}?t=90s`, 90],
    [`https://youtu.be/${ID}?t=1m30s`, 90],
    [`https://youtu.be/${ID}?t=1h2m3s`, 3723],
    [`https://www.youtube.com/watch?v=${ID}&t=45`, 45],
    [`https://www.youtube.com/embed/${ID}?start=120`, 120],
  ])('reads the start of %s', (url, seconds) => {
    expect(parseYouTubeUrl(url)).toEqual({ id: ID, startSeconds: seconds });
  });

  it.each(['abc', '0', '0s', '-5', '1.5', '999999999999', ''])(
    'ignores an invalid or zero start (%p) without invalidating the link',
    (t) => {
      expect(parseYouTubeUrl(`https://youtu.be/${ID}?t=${t}`)).toEqual({
        id: ID,
        startSeconds: 0,
      });
    },
  );
});

describe('toYouTubeEmbedUrl', () => {
  it('uses the no-cookie domain and keeps the start', () => {
    expect(toYouTubeEmbedUrl({ id: ID, startSeconds: 0 })).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}`,
    );
    expect(toYouTubeEmbedUrl({ id: ID, startSeconds: 90 })).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?start=90`,
    );
  });
});

describe('module video link schema (R27)', () => {
  it('rejects a video that is not a YouTube link, in Spanish', () => {
    const result = createTrainingModuleSchema.safeParse({
      title: 'Módulo',
      videoUrl: 'https://vimeo.com/123456789',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'El video debe ser un enlace de YouTube (youtube.com o youtu.be).',
    );
    expect(result.error?.issues[0]?.path).toEqual(['videoUrl']);
  });

  it('keeps accepting any https URL for the presentation, but not http', () => {
    expect(
      updateTrainingModuleSchema.safeParse({ presentationUrl: 'https://example.com/x.pdf' })
        .success,
    ).toBe(true);
    expect(
      updateTrainingModuleSchema.safeParse({ presentationUrl: 'http://example.com/x.pdf' }).success,
    ).toBe(false);
  });

  it('accepts a YouTube link and null', () => {
    expect(updateTrainingModuleSchema.parse({ videoUrl: `https://youtu.be/${ID}` })).toEqual({
      videoUrl: `https://youtu.be/${ID}`,
    });
    expect(updateTrainingModuleSchema.parse({ videoUrl: null })).toEqual({ videoUrl: null });
  });
});
