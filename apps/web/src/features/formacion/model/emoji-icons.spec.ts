import { emojiIcon } from './emoji-icons';

describe('emojiIcon', () => {
  const known: [string, string][] = [
    ['🐷', 'ahorro'],
    ['🏅', 'medalla'],
    ['🗣', 'idiomas'],
    ['🤝', 'acuerdo'],
    ['🎂', 'pastel'],
    ['📈', 'tendencia'],
    ['🎓', 'birrete'],
    ['🏖', 'sol'],
    ['🎒', 'morral'],
    ['🍽', 'cubiertos'],
    ['🎟', 'tiquete'],
    ['👶', 'bebe'],
    ['🛟', 'salvavidas'],
    ['📣', 'megafono'],
  ];

  it.each(known)('maps %s to %s', (emoji, icon) => {
    expect(emojiIcon(emoji)).toBe(icon);
  });

  it.each(known)('maps %s with the variation selector to the same icon', (emoji, icon) => {
    expect(emojiIcon(`${emoji}\uFE0F`)).toBe(icon);
  });

  it('uses the generic star for unknown, empty or missing emojis', () => {
    expect(emojiIcon('🦄')).toBe('estrella');
    expect(emojiIcon('')).toBe('estrella');
    expect(emojiIcon(undefined)).toBe('estrella');
    expect(emojiIcon(null)).toBe('estrella');
    expect(emojiIcon('texto')).toBe('estrella');
  });
});
