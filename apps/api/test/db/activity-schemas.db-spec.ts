import {
  evaluateSimulator,
  parseActivityConfig,
  parseActivityProgressDetail,
  TrainingActivityType,
  type SimulatorConfig,
} from '@gns/shared';
import { BENEFITS_ACTIVITIES, type ActivitySeed } from '../../prisma/seed/initial/benefits.data.ts';

// Esquemas Zod y simulador de @gns/shared (R3, R4 y R5). No usan la base de datos,
// pero viven con las demás pruebas de `test:db` para ejecutarse en la misma CI.

/** Las partes de una configuración que las pruebas modifican. */
interface Loose {
  tarjetas: { clave: string; pregunta: { correcta: number } }[];
  pares: unknown[];
  entradas: { inicial: number }[];
  constantes: unknown[];
  calculos: unknown[];
  resultados: unknown[];
  notas: unknown[];
  por_partida: number;
  umbral_aprobacion: number;
  codigo?: string;
}

function activityByTitle(title: string): ActivitySeed {
  const activity = BENEFITS_ACTIVITIES.find((candidate) => candidate.title === title);
  if (!activity) {
    throw new Error(`No existe la actividad ${title}`);
  }
  return activity;
}

function simulatorConfig(title: string): SimulatorConfig {
  const parsed = parseActivityConfig(TrainingActivityType.Simulator, activityByTitle(title).config);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}

/** Copia profunda editable de una configuración de los datos iniciales. */
function cloneConfig(title: string): Loose {
  return structuredClone(activityByTitle(title).config) as unknown as Loose;
}

/** Simulador de ahorro con otros cálculos; el resultado único es `x`. */
function simulatorWith(calculos: unknown[]): Loose {
  const config = cloneConfig('Simulador de ahorro mutuo');
  config.calculos = calculos;
  config.resultados = [{ clave: 'x', etiqueta: 'Resultado', formato: 'numero' }];
  config.notas = [];
  return config;
}

const parseSimulator = (config: unknown) =>
  parseActivityConfig(TrainingActivityType.Simulator, config).success;

describe('activity configuration schemas', () => {
  it.each(BENEFITS_ACTIVITIES.map((activity) => [activity.title, activity] as const))(
    'accepts the initial data of %s',
    (_title, activity) => {
      expect(parseActivityConfig(activity.type, activity.config).success).toBe(true);
    },
  );

  it('rejects a wheel card whose correct answer is not an option', () => {
    const config = cloneConfig('Ruleta de beneficios');
    config.tarjetas[0]!.pregunta.correcta = 5;

    expect(parseActivityConfig(TrainingActivityType.WheelPassport, config).success).toBe(false);
  });

  it('rejects wheel cards with repeated keys', () => {
    const config = cloneConfig('Ruleta de beneficios');
    config.tarjetas[1]!.clave = config.tarjetas[0]!.clave;

    expect(parseActivityConfig(TrainingActivityType.WheelPassport, config).success).toBe(false);
  });

  it('rejects a match with fewer pairs than the rounds need', () => {
    const config = cloneConfig('Conecta');
    config.pares = config.pares.slice(0, 9);

    expect(parseActivityConfig(TrainingActivityType.Match, config).success).toBe(false);
  });

  it('rejects a true-or-myth game longer than its statements', () => {
    const config = cloneConfig('¿Verdad o mito?');
    config.por_partida = 13;

    expect(parseActivityConfig(TrainingActivityType.TrueOrMyth, config).success).toBe(false);
  });

  it.each([-1, 101])('rejects an approval threshold of %i', (threshold) => {
    const config = cloneConfig('Conecta');
    config.umbral_aprobacion = threshold;

    expect(parseActivityConfig(TrainingActivityType.Match, config).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    const config = cloneConfig('Conecta');
    config.codigo = 'alert(1)';

    expect(parseActivityConfig(TrainingActivityType.Match, config).success).toBe(false);
  });

  it('rejects an initial selection that is not one of its options', () => {
    const config = cloneConfig('Simulador de bilingüismo');
    config.entradas[0]!.inicial = 123;

    expect(parseSimulator(config)).toBe(false);
  });

  describe('progress detail', () => {
    const wheel = activityByTitle('Ruleta de beneficios').config;
    const keys = (wheel.tarjetas as { clave: string }[]).map((card) => card.clave);

    it('accepts stamps that are cards of the passport', () => {
      const parsed = parseActivityProgressDetail(
        TrainingActivityType.WheelPassport,
        { sellos: keys.slice(0, 5) },
        wheel,
      );

      expect(parsed.success).toBe(true);
    });

    it.each([
      ['an unknown stamp', { sellos: ['no_existe'] }],
      ['a repeated stamp', { sellos: [keys[0], keys[0]] }],
    ])('rejects %s', (_name, detail) => {
      expect(
        parseActivityProgressDetail(TrainingActivityType.WheelPassport, detail, wheel).success,
      ).toBe(false);
    });

    it.each([TrainingActivityType.Simulator, TrainingActivityType.Match])(
      'requires a null detail for %s',
      (type) => {
        expect(parseActivityProgressDetail(type, null, {}).success).toBe(true);
        expect(parseActivityProgressDetail(type, { valores: { salario: 1 } }, {}).success).toBe(
          false,
        );
      },
    );
  });
});

describe('simulator schema limits', () => {
  const only = (expresion: unknown) => [{ clave: 'x', expresion }];

  it('accepts a calculation that references an earlier calculation', () => {
    const config = simulatorWith([
      { clave: 'a', expresion: { ref: 'anios' } },
      { clave: 'x', expresion: { op: 'suma', args: [{ ref: 'a' }, 1] } },
    ]);

    expect(parseSimulator(config)).toBe(true);
  });

  it.each([
    ['an operation outside the catalog', only({ op: 'eval', args: [1, 2] })],
    ['text instead of a structured expression', only('anios * 2')],
    ['an unknown reference', only({ ref: 'no_existe' })],
    [
      'a reference declared later',
      [
        { clave: 'x', expresion: { ref: 'despues' } },
        { clave: 'despues', expresion: 1 },
      ],
    ],
    ['a reference to itself', only({ ref: 'x' })],
    ['an extra field on a node', only({ op: 'suma', args: [1, 2], codigo: 'x' })],
    ['a wrong number of arguments', only({ op: 'resta', args: [1] })],
  ])('rejects %s', (_name, calculos) => {
    expect(parseSimulator(simulatorWith(calculos))).toBe(false);
  });

  function nested(depth: number): unknown {
    return depth === 1 ? 1 : { op: 'suma', args: [nested(depth - 1), 1] };
  }

  it('accepts a depth of 8 and rejects a depth of 9', () => {
    expect(parseSimulator(simulatorWith(only(nested(8))))).toBe(true);
    expect(parseSimulator(simulatorWith(only(nested(9))))).toBe(false);
  });

  it('rejects an expression with more than 60 nodes', () => {
    const row = { op: 'suma', args: [1, 2, 3, 4, 5, 6, 7, 8] };
    const wide = { op: 'suma', args: Array.from({ length: 8 }, () => row) };

    expect(parseSimulator(simulatorWith(only({ op: 'suma', args: [wide, wide] })))).toBe(false);
  });

  it('rejects repeated keys between inputs, constants and calculations', () => {
    const config = simulatorWith(only(1));
    config.constantes = [{ clave: 'anios', valor: 1 }];

    expect(parseSimulator(config)).toBe(false);
  });
});

describe('evaluateSimulator', () => {
  const evaluate = (title: string, values: Record<string, number>) =>
    evaluateSimulator(simulatorConfig(title), values).calculos;

  it('computes the savings reference case', () => {
    expect(
      evaluate('Simulador de ahorro mutuo', { salario: 2_000_000, pct: 5, anios: 3 }),
    ).toMatchObject({ mensual: 100_000, colegio: 50_000, total: 5_400_000, retiro_anticipado: 0 });
  });

  it('flags early withdrawal below 3 years', () => {
    const evaluation = evaluateSimulator(simulatorConfig('Simulador de ahorro mutuo'), {
      salario: 1_000_000,
      anios: 2,
    });

    expect(evaluation.notas).toContain('Recuerda: los retiros se habilitan desde el 3.er año.');
  });

  it('returns null results while the salary is missing', () => {
    const evaluation = evaluateSimulator(simulatorConfig('Simulador de ahorro mutuo'), {});

    expect(evaluation.resultados.map((result) => result.valor)).toEqual([null, null, null]);
  });

  it('computes the performance bonus cases', () => {
    expect(
      evaluate('Simulador de bono de desempeño', { salario: 2_000_000, auto: 4, jefe: 3.5 }),
    ).toMatchObject({ nota: 3.6, fraccion: 1, bono: 2_000_000, mitad: 1_000_000 });
    expect(
      evaluate('Simulador de bono de desempeño', { salario: 3_000_000, auto: 3, jefe: 3 }),
    ).toMatchObject({ nota: 3, fraccion: 1 / 3, bono: 3_000_000 * (1 / 3) });
    expect(
      evaluate('Simulador de bono de desempeño', { salario: 3_000_000, auto: 1, jefe: 2 }),
    ).toMatchObject({ fraccion: 0, bono: 0, sin_bono: 1 });
  });

  it.each([
    [10, 13.5, 2, 2],
    [24, 49, 3, 4],
    [0, 0, 0, 0],
    [4, 4, 1, 0],
    [19, 34, 2.5, 3],
  ])('computes the seniority bonus for %i years', (years, accumulated, rate, fiveYears) => {
    expect(evaluate('Simulador de bono de antigüedad', { anios: years })).toMatchObject({
      acumulado: accumulated,
      tasa_anio: rate,
      quinquenios: fiveYears,
    });
  });

  it('computes the cabin cases', () => {
    const base = { antiguedad: 1, evaluacion: 3, personas: 16, noches: 3 };

    expect(evaluate('Simulador de cabaña en Coveñas', base)).toMatchObject({
      cumple: 1,
      costo: 157_581,
    });
    expect(evaluate('Simulador de cabaña en Coveñas', { ...base, noches: 2 })).toMatchObject({
      costo: 105_054,
    });
    expect(evaluate('Simulador de cabaña en Coveñas', { ...base, personas: 17 })).toMatchObject({
      cumple_personas: 0,
      cumple: 0,
      costo: 0,
    });
  });

  it('computes the bilingual recognition', () => {
    expect(evaluate('Simulador de bilingüismo', { nivel: 1_000_000, jornada: 50 })).toMatchObject({
      valor: 500_000,
    });
    expect(evaluate('Simulador de bilingüismo', { nivel: 0, jornada: 100 })).toMatchObject({
      valor: 0,
      no_aplica: 1,
    });
  });

  it('treats an out-of-range or unknown option as missing', () => {
    expect(evaluate('Simulador de bilingüismo', { nivel: 12345, jornada: 100 }).valor).toBeNull();
    expect(evaluate('Simulador de bilingüismo', { nivel: 660_000, jornada: 500 }).valor).toBeNull();
  });
});
