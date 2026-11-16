import { parseActivityConfig } from '@gns/shared';

import {
  ACTIVITY_TYPES,
  errorsUnder,
  isDraftDirty,
  issueMessage,
  newDraft,
  toDraft,
  validateDraft,
  type ActivityDraft,
} from './activity-form';
import { DEMO_ACTIVITIES } from './demo-activities.fixture';
import { parseDecimal } from './form-numbers';
import { activity } from './test-fixtures';

function demoDraft(index: number): ActivityDraft {
  const demo = DEMO_ACTIVITIES[index];
  if (!demo) {
    throw new Error('missing demo activity');
  }
  const result = toDraft(
    activity(index, {
      type: demo.type,
      title: demo.title,
      instructions: demo.instructions,
      config: demo.config,
    }),
  );
  if (!result.editable) {
    throw new Error('demo activity is not editable');
  }
  return result.draft;
}

describe('parseDecimal', () => {
  it('accepts comma or dot decimals and spaces, empty is absent and text is NaN', () => {
    expect(parseDecimal('1,5')).toBe(1.5);
    expect(parseDecimal(' 2.25 ')).toBe(2.25);
    expect(parseDecimal('-3')).toBe(-3);
    expect(parseDecimal('')).toBeUndefined();
    expect(parseDecimal('   ')).toBeUndefined();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('1,2,3')).toBeNaN();
  });
});

describe('newDraft', () => {
  it('starts each type with the demo defaults', () => {
    const wheel = newDraft('ruleta_pasaporte');
    const match = newDraft('conecta');
    const myth = newDraft('verdad_o_mito');
    const simulator = newDraft('simulador');
    expect(wheel.type === 'ruleta_pasaporte' && wheel.config.cards).toHaveLength(2);
    expect(wheel.type === 'ruleta_pasaporte' && wheel.config.cards[0]?.options).toHaveLength(2);
    expect(match.type === 'conecta' && match.config).toMatchObject({
      perRound: '5',
      rounds: '2',
      seconds: '45',
      threshold: '80',
    });
    expect(myth.type === 'verdad_o_mito' && myth.config).toMatchObject({
      perGame: '10',
      lives: '3',
      seconds: '10',
      threshold: '80',
    });
    expect(simulator.type === 'simulador' && simulator.config.inputs).toHaveLength(1);
    expect(simulator.type === 'simulador' && simulator.config.calculations).toHaveLength(0);
    for (const type of ACTIVITY_TYPES) {
      expect(newDraft(type).id).toBeNull();
    }
  });

  it('shows errors per field until the form is completed', () => {
    const result = validateDraft(newDraft('conecta'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.title).toBe('Escríbelo.');
      expect(result.errors['config.pares.0.concepto']).toBe('Escríbelo.');
      expect(result.errors['config.pares']).toBe(
        'Faltan pares: necesitas al menos pares por ronda × rondas.',
      );
    }
  });
});

describe('toDraft', () => {
  it('is not editable when the stored configuration fails its schema', () => {
    expect(toDraft(activity(1, { type: 'conecta', config: { pares: [] } }))).toEqual({
      editable: false,
    });
  });
});

describe('round trip with the demo activities', () => {
  it.each(DEMO_ACTIVITIES.map((demo, index) => [demo.title, index] as const))(
    'returns the same configuration for «%s»',
    (_title, index) => {
      const demo = DEMO_ACTIVITIES[index];
      const result = validateDraft(demoDraft(index));
      expect(result.ok).toBe(true);
      if (result.ok && demo) {
        const parsed = parseActivityConfig(demo.type, demo.config);
        expect(parsed.success).toBe(true);
        expect(result.update.config).toEqual(parsed.success ? parsed.data : null);
        expect(result.create.config).toEqual(result.update.config);
        expect(result.update.instructions).toBe(demo.instructions);
      }
    },
  );

  it('never reports changes on an untouched existing activity', () => {
    for (let index = 0; index < DEMO_ACTIVITIES.length; index += 1) {
      expect(isDraftDirty(demoDraft(index), demoDraft(index))).toBe(false);
    }
  });
});

describe('validateDraft', () => {
  it('builds the create body with null instructions when empty', () => {
    const draft = demoDraft(1);
    const result = validateDraft({ ...draft, id: null, instructions: '  ', isRequired: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.create).toMatchObject({
        type: 'conecta',
        isRequired: true,
        instructions: null,
      });
      expect(Object.keys(result.update).sort()).toEqual(['config', 'instructions', 'title']);
    }
  });

  it('reports a nested error under its schema path', () => {
    const draft = demoDraft(0);
    if (draft.type !== 'ruleta_pasaporte') {
      throw new Error('expected wheel');
    }
    const cards = draft.config.cards.map((card, index) =>
      index === 2 ? { ...card, linkText: 'Texto', linkUrl: 'http://x.co' } : card,
    );
    const result = validateDraft({ ...draft, config: { ...draft.config, cards } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors['config.tarjetas.2.enlace.url']).toBeDefined();
      expect(errorsUnder(result.errors, 'config.tarjetas.2')).toHaveLength(1);
      expect(errorsUnder(result.errors, 'config.tarjetas.1')).toEqual([]);
    }
  });

  it('asks for a number when a numeric field is not one', () => {
    const draft = demoDraft(1);
    if (draft.type !== 'conecta') {
      throw new Error('expected match');
    }
    const result = validateDraft({ ...draft, config: { ...draft.config, rounds: 'x' } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors['config.rondas']).toBe('Escribe un número.');
    }
  });

  it('gives the allowed range for out-of-range numbers', () => {
    const draft = demoDraft(1);
    if (draft.type !== 'conecta') {
      throw new Error('expected match');
    }
    const result = validateDraft({ ...draft, config: { ...draft.config, threshold: '120' } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors['config.umbral_aprobacion']).toBe('Usa un número entre 0 y 100.');
    }
  });
});

describe('issueMessage', () => {
  it('translates by code and origin', () => {
    expect(
      issueMessage({ code: 'too_small', path: ['title'], origin: 'string', message: 'x' }),
    ).toBe('Escríbelo.');
    expect(
      issueMessage({
        code: 'too_big',
        path: ['title'],
        origin: 'string',
        maximum: 80,
        message: 'x',
      }),
    ).toBe('Escribe como máximo 80 caracteres.');
    expect(
      issueMessage({
        code: 'too_small',
        path: ['hechos'],
        origin: 'array',
        minimum: 1,
        message: 'x',
      }),
    ).toBe('Agrega al menos 1.');
    expect(
      issueMessage({
        code: 'too_big',
        path: ['hechos'],
        origin: 'array',
        maximum: 6,
        message: 'x',
      }),
    ).toBe('Como máximo 6.');
    expect(
      issueMessage({ code: 'invalid_type', path: ['vidas'], expected: 'number', message: 'x' }),
    ).toBe('Escribe un número.');
    expect(
      issueMessage({ code: 'invalid_format', path: ['url'], format: 'url', message: 'x' }),
    ).toBe('Usa una dirección https.');
    expect(
      issueMessage({
        code: 'invalid_format',
        path: ['clave'],
        format: 'regex',
        message: 'La clave debe ser…',
      }),
    ).toBe('La clave debe ser…');
    expect(issueMessage({ code: 'custom', path: [], message: 'La clave está repetida.' })).toBe(
      'La clave está repetida.',
    );
  });
});

describe('isDraftDirty', () => {
  it('compares an existing activity with what is saved, ignoring surrounding spaces', () => {
    const saved = demoDraft(1);
    expect(isDraftDirty(saved, { ...saved, title: ` ${saved.title} ` })).toBe(false);
    expect(isDraftDirty(saved, { ...saved, title: 'Otro título' })).toBe(true);
  });

  it('a new draft is dirty only after something is written', () => {
    const draft = newDraft('verdad_o_mito');
    expect(isDraftDirty(null, draft)).toBe(false);
    expect(isDraftDirty(null, { ...draft, title: 'Nueva' })).toBe(true);
  });
});
