import { simulatorConfigSchema } from '@gns/shared';

import { refNode } from './expression-tree';
import { DEMO_ACTIVITIES } from './demo-activities.fixture';
import {
  availableKeys,
  dropCalculation,
  initialSimulatorForm,
  inputOfKind,
  newCalculation,
  renameKey,
  simulatorFromForm,
  simulatorToForm,
  type SimulatorForm,
} from './simulator-form';

const simulators = DEMO_ACTIVITIES.filter((item) => item.type === 'simulador');

function demoForm(index: number): SimulatorForm {
  const demo = simulators[index];
  if (!demo) {
    throw new Error('missing simulator');
  }
  return simulatorToForm(simulatorConfigSchema.parse(demo.config));
}

describe('simulator form', () => {
  it('has the five simulators of the demo', () => {
    expect(simulators).toHaveLength(5);
  });

  it.each([0, 1, 2, 3, 4])('round-trips the demo simulator %i', (index) => {
    const demo = simulators[index];
    const parsed = simulatorConfigSchema.parse(demo?.config);
    const candidate = simulatorFromForm(demoForm(index));
    expect(simulatorConfigSchema.parse(candidate)).toEqual(parsed);
  });

  it('starts with one number input and nothing else', () => {
    const form = initialSimulatorForm();
    expect(form.inputs).toHaveLength(1);
    expect(form.calculations).toEqual([]);
    expect(form.results).toEqual([]);
  });
});

describe('inputOfKind', () => {
  it('keeps key, label and screen-only when the kind changes and resets the rest', () => {
    const base = { key: 'salario', anchor: 'salario', label: 'Salario', screenOnly: true };
    const money = inputOfKind('moneda', base);
    expect(money).toMatchObject({ ...base, kind: 'moneda', step: '1000', max: '', initial: '' });
    const choice = inputOfKind('opcion', base);
    expect(choice.options).toHaveLength(2);
    expect(inputOfKind('porcentaje', base)).toMatchObject({ min: '0', max: '100', initial: '0' });
  });

  it('builds an option input with its initial value chosen among the options', () => {
    const input = {
      ...inputOfKind('opcion', { key: 'plan', anchor: 'plan', label: 'Plan', screenOnly: false }),
      options: [
        { label: 'A', value: '1' },
        { label: 'B', value: '2' },
      ],
      initialOption: 1,
    };
    const form = { ...initialSimulatorForm(), inputs: [input] };
    const candidate = simulatorFromForm(form) as { entradas: { inicial: number }[] };
    expect(candidate.entradas[0]?.inicial).toBe(2);
  });
});

describe('availableKeys', () => {
  it('offers inputs, constants and only the calculations before the one being edited', () => {
    const form = demoForm(0);
    const first = availableKeys(form, 0);
    expect(first.inputs.length).toBeGreaterThan(0);
    expect(first.previous).toEqual([]);
    const last = availableKeys(form, form.calculations.length - 1);
    expect(last.previous).toEqual(form.calculations.slice(0, -1).map((calc) => calc.anchor));
    expect(last.previous).not.toContain(form.calculations[form.calculations.length - 1]?.anchor);
  });
});

describe('renameKey', () => {
  it('updates references in calculations, results, featured and notes', () => {
    const form = demoForm(0);
    const calc = form.calculations[0];
    if (!calc) {
      throw new Error('no calculations');
    }
    const withUse: SimulatorForm = {
      ...form,
      results: [{ calculation: calc.anchor, label: 'R', format: 'numero' }],
      featured: calc.anchor,
      notes: [{ text: 'N', when: calc.anchor }],
    };
    const renamed = renameKey(withUse, 'calculation', 0, 'nuevo_nombre');
    expect(renamed.calculations[0]).toMatchObject({ key: 'nuevo_nombre', anchor: 'nuevo_nombre' });
    expect(renamed.results[0]?.calculation).toBe('nuevo_nombre');
    expect(renamed.featured).toBe('nuevo_nombre');
    expect(renamed.notes[0]?.when).toBe('nuevo_nombre');
    expect(simulatorConfigSchema.safeParse(simulatorFromForm(renamed)).success).toBe(true);
  });

  it('renames an input used by a calculation and keeps references while the key is empty', () => {
    const base = initialSimulatorForm();
    const form: SimulatorForm = {
      ...base,
      calculations: [{ key: 'doble', anchor: 'doble', expression: refNode('valor') }],
    };
    const renamed = renameKey(form, 'input', 0, 'edad');
    expect(renamed.calculations[0]?.expression.ref).toBe('edad');
    const empty = renameKey(renamed, 'input', 0, '');
    expect(empty.inputs[0]).toMatchObject({ key: '', anchor: 'edad' });
    expect(empty.calculations[0]?.expression.ref).toBe('edad');
    const typed = renameKey(empty, 'input', 0, 'x');
    expect(typed.calculations[0]?.expression.ref).toBe('x');
  });

  it('renames a constant', () => {
    const form = demoForm(0);
    const constant = form.constants[0];
    if (!constant) {
      throw new Error('no constants');
    }
    const renamed = renameKey(form, 'constant', 0, 'factor_nuevo');
    expect(renamed.constants[0]?.anchor).toBe('factor_nuevo');
    expect(JSON.stringify(renamed.calculations)).not.toContain(`"ref":"${constant.anchor}"`);
  });
});

describe('calculations', () => {
  it('gives each new calculation a key that is not taken', () => {
    const form = demoForm(0);
    const created = newCalculation(form);
    const taken = new Set([
      ...form.inputs.map((input) => input.anchor),
      ...form.constants.map((constant) => constant.anchor),
      ...form.calculations.map((calc) => calc.anchor),
    ]);
    expect(taken.has(created.key)).toBe(false);
  });

  it('removing a calculation also clears its results, featured and note conditions', () => {
    const form = demoForm(0);
    const key = form.calculations[0]?.anchor ?? '';
    const used: SimulatorForm = {
      ...form,
      results: [{ calculation: key, label: 'R', format: 'numero' }],
      featured: key,
      notes: [{ text: 'N', when: key }],
    };
    const next = dropCalculation(used, 0);
    expect(next.calculations).toHaveLength(form.calculations.length - 1);
    expect(next.results).toEqual([]);
    expect(next.featured).toBe('');
    expect(next.notes[0]?.when).toBe('');
  });
});
