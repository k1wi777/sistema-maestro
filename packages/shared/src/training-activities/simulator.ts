import { z } from 'zod';
import { activityKey, shortText } from './common';

/**
 * Simulador declarativo. La configuración es solo datos: un árbol JSON cuyos nodos
 * pertenecen a un catálogo cerrado. Nunca se interpreta texto ni se ejecuta código.
 */

export const SIMULATOR_LIMITS = {
  maxDepth: 8,
  maxNodes: 60,
  maxInputs: 10,
  maxConstants: 20,
  maxCalculations: 30,
} as const;

const LITERAL_LIMIT = 1e12;

export const SimulatorComparison = {
  Greater: 'mayor',
  GreaterOrEqual: 'mayor_igual',
  Less: 'menor',
  LessOrEqual: 'menor_igual',
  Equal: 'igual',
} as const;
export type SimulatorComparison = (typeof SimulatorComparison)[keyof typeof SimulatorComparison];

export const SimulatorResultFormat = {
  Currency: 'moneda',
  Percentage: 'porcentaje',
  Number: 'numero',
  YesNo: 'si_no',
} as const;
export type SimulatorResultFormat =
  (typeof SimulatorResultFormat)[keyof typeof SimulatorResultFormat];

export type SimulatorExpression =
  | number
  | { ref: string }
  | {
      op: 'suma' | 'multiplica' | 'minimo' | 'maximo' | 'todos' | 'alguno';
      args: SimulatorExpression[];
    }
  | { op: 'resta' | 'divide'; args: [SimulatorExpression, SimulatorExpression] }
  | { op: 'piso' | 'no'; args: [SimulatorExpression] }
  | { op: 'redondea'; decimales: number; args: [SimulatorExpression] }
  | {
      op: 'compara';
      comparacion: SimulatorComparison;
      args: [SimulatorExpression, SimulatorExpression];
    }
  | { op: 'si'; args: [SimulatorExpression, SimulatorExpression, SimulatorExpression] }
  | {
      tramos: {
        clave: string;
        hasta: { hasta: number; valor: SimulatorExpression }[];
        resto: SimulatorExpression;
      };
    };

const literal = z.number().min(-LITERAL_LIMIT).max(LITERAL_LIMIT);

const expressionSchema: z.ZodType<SimulatorExpression> = z.lazy(() => {
  const operation = z.discriminatedUnion('op', [
    z.strictObject({
      op: z.enum(['suma', 'multiplica', 'minimo', 'maximo']),
      args: z.array(expressionSchema).min(2).max(8),
    }),
    z.strictObject({
      op: z.enum(['todos', 'alguno']),
      args: z.array(expressionSchema).min(1).max(8),
    }),
    z.strictObject({
      op: z.enum(['resta', 'divide']),
      args: z.tuple([expressionSchema, expressionSchema]),
    }),
    z.strictObject({ op: z.enum(['piso', 'no']), args: z.tuple([expressionSchema]) }),
    z.strictObject({
      op: z.literal('redondea'),
      decimales: z.number().int().min(0).max(4),
      args: z.tuple([expressionSchema]),
    }),
    z.strictObject({
      op: z.literal('compara'),
      comparacion: z.enum(['mayor', 'mayor_igual', 'menor', 'menor_igual', 'igual']),
      args: z.tuple([expressionSchema, expressionSchema]),
    }),
    z.strictObject({
      op: z.literal('si'),
      args: z.tuple([expressionSchema, expressionSchema, expressionSchema]),
    }),
  ]);
  return z.union([
    literal,
    z.strictObject({ ref: activityKey }),
    operation,
    z.strictObject({
      tramos: z.strictObject({
        clave: activityKey,
        hasta: z
          .array(z.strictObject({ hasta: literal, valor: expressionSchema }))
          .min(1)
          .max(10)
          .superRefine((steps, context) => {
            // El evaluador toma el primer tramo con valor <= hasta: un límite
            // repetido o menor sería inalcanzable.
            steps.forEach((current, index) => {
              const previous = steps[index - 1];
              if (previous !== undefined && current.hasta <= previous.hasta) {
                context.addIssue({
                  code: 'custom',
                  path: [index, 'hasta'],
                  message: 'Los límites de los tramos deben ir en orden ascendente.',
                });
              }
            });
          }),
        resto: expressionSchema,
      }),
    }),
  ]);
});

/** Hijos de un nodo, sin suponer que el nodo ya pasó la validación estructural. */
function childrenOf(node: unknown): unknown[] {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return [];
  }
  const record = node as Record<string, unknown>;
  const children: unknown[] = Array.isArray(record.args) ? [...(record.args as unknown[])] : [];
  const tramos = record.tramos;
  if (typeof tramos === 'object' && tramos !== null) {
    const { hasta, resto } = tramos as Record<string, unknown>;
    if (Array.isArray(hasta)) {
      for (const step of hasta as unknown[]) {
        if (typeof step === 'object' && step !== null) {
          children.push((step as Record<string, unknown>).valor);
        }
      }
    }
    children.push(resto);
  }
  return children;
}

/** Claves a las que un nodo hace referencia directamente. */
function referencesOf(node: unknown): string[] {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return [];
  }
  const record = node as Record<string, unknown>;
  const refs: string[] = [];
  if (typeof record.ref === 'string') {
    refs.push(record.ref);
  }
  const tramos = record.tramos;
  if (typeof tramos === 'object' && tramos !== null) {
    const clave = (tramos as Record<string, unknown>).clave;
    if (typeof clave === 'string') {
      refs.push(clave);
    }
  }
  return refs;
}

/** Recorrido iterativo con tope: una expresión enorme no agota la pila ni el tiempo. */
function walkExpression(root: unknown, onNode: (node: unknown, depth: number) => boolean): void {
  const pending: { node: unknown; depth: number }[] = [{ node: root, depth: 1 }];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (!onNode(next.node, next.depth)) {
      return;
    }
    for (const child of childrenOf(next.node)) {
      pending.push({ node: child, depth: next.depth + 1 });
    }
  }
}

function expressionMeasure(root: unknown): { nodes: number; depth: number } {
  let nodes = 0;
  let depth = 0;
  walkExpression(root, (_node, nodeDepth) => {
    nodes += 1;
    depth = Math.max(depth, nodeDepth);
    return nodes <= SIMULATOR_LIMITS.maxNodes && depth <= SIMULATOR_LIMITS.maxDepth;
  });
  return { nodes, depth };
}

/** Comprueba tamaño y profundidad antes de validar la estructura. */
const boundedExpression = z
  .unknown()
  .superRefine((value, context) => {
    const { nodes, depth } = expressionMeasure(value);
    if (nodes > SIMULATOR_LIMITS.maxNodes) {
      context.addIssue({
        code: 'custom',
        message: `La expresión supera ${SIMULATOR_LIMITS.maxNodes} nodos.`,
      });
    } else if (depth > SIMULATOR_LIMITS.maxDepth) {
      context.addIssue({
        code: 'custom',
        message: `La expresión supera la profundidad ${SIMULATOR_LIMITS.maxDepth}.`,
      });
    }
  })
  .pipe(expressionSchema);

const inputBase = {
  clave: activityKey,
  etiqueta: shortText(80),
  // El valor se queda en el navegador: no se guarda ni se envía al servidor.
  solo_en_pantalla: z.boolean().default(false),
};

const step = z.number().positive().max(LITERAL_LIMIT);

const rangeIsCoherent = (input: {
  min: number;
  max?: number | undefined;
  inicial?: number | undefined;
}): boolean =>
  (input.max === undefined || input.min <= input.max) &&
  (input.inicial === undefined ||
    (input.inicial >= input.min && (input.max === undefined || input.inicial <= input.max)));

const rangeMessage = { path: ['inicial'], message: 'El rango de la entrada no es coherente.' };

const inputSchema = z.discriminatedUnion('tipo', [
  z
    .strictObject({
      ...inputBase,
      tipo: z.literal('moneda'),
      unidad: shortText(16).optional(),
      min: literal,
      max: literal.optional(),
      paso: step,
      inicial: literal.optional(),
    })
    .refine(rangeIsCoherent, rangeMessage),
  z
    .strictObject({
      ...inputBase,
      tipo: z.enum(['numero', 'porcentaje']),
      unidad: shortText(16).optional(),
      min: literal,
      max: literal,
      paso: step,
      inicial: literal,
    })
    .refine(rangeIsCoherent, rangeMessage),
  z
    .strictObject({
      ...inputBase,
      tipo: z.literal('opcion'),
      opciones: z
        .array(z.strictObject({ etiqueta: shortText(80), valor: literal }))
        .min(2)
        .max(6),
      inicial: literal,
    })
    .refine((input) => input.opciones.some((option) => option.valor === input.inicial), {
      path: ['inicial'],
      message: 'El valor inicial debe ser uno de los valores de las opciones.',
    }),
]);
export type SimulatorInput = z.infer<typeof inputSchema>;

export const simulatorConfigSchema = z
  .strictObject({
    entradas: z.array(inputSchema).min(1).max(SIMULATOR_LIMITS.maxInputs),
    constantes: z
      .array(z.strictObject({ clave: activityKey, valor: literal }))
      .max(SIMULATOR_LIMITS.maxConstants),
    calculos: z
      .array(z.strictObject({ clave: activityKey, expresion: boundedExpression }))
      .min(1)
      .max(SIMULATOR_LIMITS.maxCalculations),
    resultados: z
      .array(
        z.strictObject({
          clave: activityKey,
          etiqueta: shortText(80),
          formato: z.enum(['moneda', 'porcentaje', 'numero', 'si_no']),
        }),
      )
      .min(1)
      .max(20),
    notas: z
      .array(z.strictObject({ texto: shortText(300), cuando: activityKey.optional() }))
      .max(10),
    icono: shortText(8).optional(),
    destacado: z.strictObject({ clave: activityKey, subtitulo: shortText(120) }).optional(),
  })
  .superRefine((config, context) => {
    const declared = new Set<string>();
    const declare = (path: (string | number)[], key: string): void => {
      if (declared.has(key)) {
        context.addIssue({ code: 'custom', path, message: 'La clave está repetida.' });
      }
      declared.add(key);
    };
    config.entradas.forEach((input, index) => declare(['entradas', index, 'clave'], input.clave));
    config.constantes.forEach((constant, index) =>
      declare(['constantes', index, 'clave'], constant.clave),
    );

    const calculationKeys = new Set(config.calculos.map((calculation) => calculation.clave));
    config.calculos.forEach((calculation, index) => {
      // Solo se puede referir a entradas, constantes y cálculos anteriores.
      walkExpression(calculation.expresion, (node) => {
        for (const ref of referencesOf(node)) {
          if (!declared.has(ref)) {
            context.addIssue({
              code: 'custom',
              path: ['calculos', index, 'expresion'],
              message: 'La referencia apunta a una clave no declarada o declarada después.',
            });
          }
        }
        return true;
      });
      declare(['calculos', index, 'clave'], calculation.clave);
    });

    const resultKeys = new Set<string>();
    config.resultados.forEach((result, index) => {
      if (resultKeys.has(result.clave)) {
        context.addIssue({
          code: 'custom',
          path: ['resultados', index, 'clave'],
          message: 'La clave del resultado está repetida.',
        });
      }
      resultKeys.add(result.clave);
      if (!calculationKeys.has(result.clave)) {
        context.addIssue({
          code: 'custom',
          path: ['resultados', index, 'clave'],
          message: 'El resultado debe corresponder a un cálculo.',
        });
      }
    });
    if (
      config.destacado !== undefined &&
      !config.resultados.some((result) => result.clave === config.destacado?.clave)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['destacado', 'clave'],
        message: 'El resultado destacado debe ser uno de los resultados.',
      });
    }
    config.notas.forEach((note, index) => {
      if (note.cuando !== undefined && !calculationKeys.has(note.cuando)) {
        context.addIssue({
          code: 'custom',
          path: ['notas', index, 'cuando'],
          message: 'La condición debe corresponder a un cálculo.',
        });
      }
    });
  });
export type SimulatorConfig = z.infer<typeof simulatorConfigSchema>;
