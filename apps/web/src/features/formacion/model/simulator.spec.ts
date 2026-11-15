import { simulatorConfigSchema } from '@gns/shared';

import {
  evaluateWith,
  formatInputValue,
  formatMoneyInput,
  formatSimulatorValue,
  inputValueOf,
  parseMoneyInput,
  sharedKey,
  valuesForConfig,
} from './simulator';
import { SIMULATOR_CONFIG } from './test-fixtures-activities';

const config = simulatorConfigSchema.parse(SIMULATOR_CONFIG);
const [salary, years] = config.entradas;
if (!salary || !years) {
  throw new Error('fixture without inputs');
}

// Intl separa «$» del número con espacios sin ruptura según la versión de ICU.
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatSimulatorValue', () => {
  it('formats money as Colombian pesos without decimals', () => {
    expect(plain(formatSimulatorValue(1250000, 'moneda'))).toBe('$1.250.000');
    expect(plain(formatSimulatorValue(1999.6, 'moneda'))).toBe('$2.000');
    expect(plain(formatSimulatorValue(0, 'moneda'))).toBe('$0');
  });

  it('shows percentages as given, with the percent sign', () => {
    expect(formatSimulatorValue(12.5, 'porcentaje')).toBe('12,5%');
    expect(formatSimulatorValue(8, 'porcentaje')).toBe('8%');
  });

  it('shows numbers with up to two decimals', () => {
    expect(formatSimulatorValue(3, 'numero')).toBe('3');
    expect(formatSimulatorValue(3.14159, 'numero')).toBe('3,14');
  });

  it('shows yes or no', () => {
    expect(formatSimulatorValue(1, 'si_no')).toBe('Sí');
    expect(formatSimulatorValue(0, 'si_no')).toBe('No');
  });

  it('shows a dash for a value that cannot be calculated, in every format', () => {
    for (const format of ['moneda', 'porcentaje', 'numero', 'si_no'] as const) {
      expect(formatSimulatorValue(null, format)).toBe('—');
    }
  });
});

describe('money input', () => {
  it('keeps only the digits and treats an empty text as no value', () => {
    expect(parseMoneyInput('1.250.000')).toBe(1250000);
    expect(parseMoneyInput('$ 3 000 abc')).toBe(3000);
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('abc')).toBeNull();
  });

  it('limits the number of digits', () => {
    expect(parseMoneyInput('1'.repeat(30))).toBe(Number('1'.repeat(13)));
  });

  it('writes thousands with dots', () => {
    expect(formatMoneyInput(1250000)).toBe('1.250.000');
    expect(formatMoneyInput(950)).toBe('950');
  });
});

describe('shared values between simulators', () => {
  it('shares a value by key and type, not by key alone', () => {
    const shared = { [sharedKey(salary)]: 2000000 };

    expect(inputValueOf(salary, shared)).toBe(2000000);
    expect(
      inputValueOf({ ...salary, tipo: 'numero', min: 0, max: 5, inicial: 1, paso: 1 }, shared),
    ).toBe(1);
  });

  it('falls back to the initial value when the shared one does not fit the range', () => {
    expect(inputValueOf(years, { [sharedKey(years)]: 99 })).toBe(5);
    expect(inputValueOf(years, { [sharedKey(years)]: 12 })).toBe(12);
  });

  it('leaves a money input without value until something is written', () => {
    expect(inputValueOf(salary, {})).toBeUndefined();
    expect(valuesForConfig(config, {})).toEqual({ anios: 5 });
  });

  it('takes an option only if it is one of the options', () => {
    const option = {
      clave: 'plan',
      etiqueta: 'Plan',
      solo_en_pantalla: false,
      tipo: 'opcion' as const,
      opciones: [
        { etiqueta: 'A', valor: 1 },
        { etiqueta: 'B', valor: 2 },
      ],
      inicial: 1,
    };

    expect(inputValueOf(option, { [sharedKey(option)]: 2 })).toBe(2);
    expect(inputValueOf(option, { [sharedKey(option)]: 7 })).toBe(1);
  });
});

describe('evaluateWith', () => {
  it('recalculates results, the highlight and the active notes with each change', () => {
    const low = evaluateWith(config, { [sharedKey(salary)]: 50000 });
    const high = evaluateWith(config, { [sharedKey(salary)]: 2000000 });

    expect(low.resultados.find((r) => r.clave === 'anual')?.valor).toBe(600000);
    expect(low.notas).toEqual(['Siempre visible.']);
    expect(high.resultados.find((r) => r.clave === 'anual')?.valor).toBe(24000000);
    expect(high.notas).toEqual(['Es una cifra alta.', 'Siempre visible.']);
  });

  it('gives null for what depends on a missing value', () => {
    const empty = evaluateWith(config, {});

    expect(empty.resultados.find((r) => r.clave === 'anual')?.valor).toBeNull();
  });
});

describe('formatInputValue', () => {
  const range = {
    clave: 'x',
    etiqueta: 'X',
    solo_en_pantalla: false,
    min: 0,
    max: 100,
    paso: 1,
    inicial: 5,
  };

  it('adds the unit or the percent sign', () => {
    expect(formatInputValue({ ...range, tipo: 'numero', unidad: 'años' }, 7)).toBe('7 años');
    expect(formatInputValue({ ...range, tipo: 'numero' }, 7)).toBe('7');
    expect(formatInputValue({ ...range, tipo: 'porcentaje' }, 7.5)).toBe('7,5%');
  });
});
