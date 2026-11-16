import {
  cardKey,
  emptyCard,
  factLines,
  removeOption,
  wheelFromForm,
  wheelToForm,
} from './wheel-form';
import { wheelPassportConfigSchema } from '@gns/shared';

import { DEMO_ACTIVITIES } from './demo-activities.fixture';

const demo = DEMO_ACTIVITIES.find((item) => item.type === 'ruleta_pasaporte');

describe('cardKey', () => {
  it('derives a technical key from the short title', () => {
    expect(cardKey('Ahorro mutuo', new Set())).toBe('ahorro_mutuo');
    expect(cardKey('¡Bono Navideño!', new Set())).toBe('bono_navideno');
  });

  it('prefixes titles that do not start with a letter and falls back when empty', () => {
    expect(cardKey('2.º mes', new Set())).toBe('t_2_mes');
    expect(cardKey('', new Set())).toBe('t_tarjeta');
  });

  it('limits to 32 characters and adds a numeric suffix when taken', () => {
    const long = cardKey('a'.repeat(50), new Set());
    expect(long).toHaveLength(32);
    expect(cardKey('Ahorro', new Set(['ahorro']))).toBe('ahorro_2');
    expect(cardKey('Ahorro', new Set(['ahorro', 'ahorro_2']))).toBe('ahorro_3');
    expect(cardKey('a'.repeat(50), new Set([long]))).toHaveLength(32);
  });
});

describe('wheelFromForm', () => {
  it('keeps the key of existing cards even if their title changes', () => {
    const config = wheelPassportConfigSchema.parse(demo?.config);
    const form = wheelToForm(config);
    const changed = form.cards.map((card, index) =>
      index === 0 ? { ...card, shortTitle: 'Otro nombre' } : card,
    );
    const candidate = wheelFromForm({ ...form, cards: changed }) as {
      tarjetas: { clave: string }[];
    };
    expect(candidate.tarjetas.map((card) => card.clave)).toEqual(
      config.tarjetas.map((card) => card.clave),
    );
  });

  it('gives new cards a unique key that does not collide with existing ones', () => {
    const first = { ...emptyCard(), key: 'ahorro', shortTitle: 'Ahorro' };
    const added = { ...emptyCard(), shortTitle: 'Ahorro' };
    const addedAgain = { ...emptyCard(), shortTitle: 'Ahorro' };
    const candidate = wheelFromForm({ badge: 'I', cards: [first, added, addedAgain] }) as {
      tarjetas: { clave: string }[];
    };
    expect(candidate.tarjetas.map((card) => card.clave)).toEqual([
      'ahorro',
      'ahorro_2',
      'ahorro_3',
    ]);
  });

  it('omits the link when both fields are empty and splits facts by line', () => {
    const card = { ...emptyCard(), facts: ' uno \n\n dos\r\n' };
    const candidate = wheelFromForm({ badge: 'I', cards: [card] }) as {
      tarjetas: { enlace?: unknown; hechos: string[] }[];
    };
    expect(candidate.tarjetas[0]?.enlace).toBeUndefined();
    expect(candidate.tarjetas[0]?.hechos).toEqual(['uno', 'dos']);
    expect(factLines('')).toEqual([]);
  });
});

describe('removeOption', () => {
  const card = { ...emptyCard(), options: ['a', 'b', 'c'], correct: 1 };

  it('shifts the correct answer when an earlier option is removed', () => {
    expect(removeOption(card, 0)).toMatchObject({ options: ['b', 'c'], correct: 0 });
  });

  it('leaves it when a later option is removed and clears it when the correct one goes', () => {
    expect(removeOption(card, 2).correct).toBe(1);
    expect(removeOption(card, 1).correct).toBeNull();
  });
});
