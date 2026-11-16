import { emojiIcon, hasIconEquivalent, iconEmoji, PICKABLE_ICONS } from './emoji-icons';

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

describe('PICKABLE_ICONS', () => {
  it('lists the fifteen icons and round-trips each one', () => {
    expect(PICKABLE_ICONS).toHaveLength(15);
    for (const item of PICKABLE_ICONS) {
      expect(emojiIcon(item.emoji)).toBe(item.icon);
      expect(iconEmoji(item.icon)).toBe(item.emoji);
    }
  });

  it('maps the star emoji to the star icon', () => {
    expect(emojiIcon('⭐')).toBe('estrella');
  });

  it('knows which emojis have an equivalent', () => {
    expect(hasIconEquivalent('🍽️')).toBe(true);
    expect(hasIconEquivalent('🦄')).toBe(false);
    expect(hasIconEquivalent('')).toBe(false);
  });
});
