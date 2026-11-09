import type { SimulatorConfig, SimulatorExpression, SimulatorResultFormat } from './simulator';

/** Resultado numérico; `null` = no calculable (división por cero, dato ausente o no finito). */
export type SimulatorValue = number | null;

export interface SimulatorEvaluation {
  calculos: Record<string, SimulatorValue>;
  resultados: {
    clave: string;
    etiqueta: string;
    formato: SimulatorResultFormat;
    valor: SimulatorValue;
  }[];
  /** Textos de las notas cuya condición se cumple (o que no tienen condición). */
  notas: string[];
}

type Scope = Map<string, SimulatorValue>;

const finiteOrNull = (value: number): SimulatorValue => (Number.isFinite(value) ? value : null);

/** Operandos ya evaluados; si alguno es nulo, todo el nodo es nulo. */
function numbers(values: SimulatorValue[]): number[] | null {
  const result: number[] = [];
  for (const value of values) {
    if (value === null) {
      return null;
    }
    result.push(value);
  }
  return result;
}

function compare(comparison: string, left: number, right: number): boolean {
  switch (comparison) {
    case 'mayor':
      return left > right;
    case 'mayor_igual':
      return left >= right;
    case 'menor':
      return left < right;
    case 'menor_igual':
      return left <= right;
    default:
      return left === right;
  }
}

/**
 * Evalúa un nodo ya validado con un `switch` sobre el catálogo cerrado: no hay
 * `eval`, `Function` ni acceso a propiedades por nombre arbitrario.
 */
function evaluateNode(node: SimulatorExpression, scope: Scope): SimulatorValue {
  if (typeof node === 'number') {
    return node;
  }
  if ('ref' in node) {
    return scope.get(node.ref) ?? null;
  }
  if ('tramos' in node) {
    const value = scope.get(node.tramos.clave) ?? null;
    if (value === null) {
      return null;
    }
    const step = node.tramos.hasta.find((candidate) => value <= candidate.hasta);
    return evaluateNode(step ? step.valor : node.tramos.resto, scope);
  }

  if (node.op === 'si') {
    const condition = evaluateNode(node.args[0], scope);
    if (condition === null) {
      return null;
    }
    return evaluateNode(condition !== 0 ? node.args[1] : node.args[2], scope);
  }

  const operands = numbers(node.args.map((arg) => evaluateNode(arg, scope)));
  if (operands === null) {
    return null;
  }
  const [first = 0, second = 0] = operands;
  switch (node.op) {
    case 'suma':
      return finiteOrNull(operands.reduce((total, value) => total + value, 0));
    case 'multiplica':
      return finiteOrNull(operands.reduce((total, value) => total * value, 1));
    case 'minimo':
      return Math.min(...operands);
    case 'maximo':
      return Math.max(...operands);
    case 'resta':
      return finiteOrNull(first - second);
    case 'divide':
      return second === 0 ? null : finiteOrNull(first / second);
    case 'piso':
      return Math.floor(first);
    case 'redondea': {
      const factor = 10 ** node.decimales;
      return finiteOrNull(Math.round(first * factor) / factor);
    }
    case 'compara':
      return compare(node.comparacion, first, second) ? 1 : 0;
    case 'todos':
      return operands.every((value) => value !== 0) ? 1 : 0;
    case 'alguno':
      return operands.some((value) => value !== 0) ? 1 : 0;
    case 'no':
      return first === 0 ? 1 : 0;
  }
}

/** Valor de una entrada o `null` si falta o no es válido para su tipo y rango. */
function inputValue(
  input: SimulatorConfig['entradas'][number],
  given: number | undefined,
): SimulatorValue {
  const value = given ?? ('inicial' in input ? input.inicial : undefined);
  if (value === undefined || !Number.isFinite(value)) {
    return null;
  }
  if (input.tipo === 'opcion') {
    return input.opciones.some((option) => option.valor === value) ? value : null;
  }
  const withinMax = input.max === undefined || value <= input.max;
  return value >= input.min && withinMax ? value : null;
}

/**
 * Calcula los resultados de un simulador a partir de su configuración validada y
 * de los valores de las entradas por clave. Una entrada ausente usa su valor
 * inicial; una fuera de rango anula lo que depende de ella.
 */
export function evaluateSimulator(
  config: SimulatorConfig,
  values: Readonly<Record<string, number>>,
): SimulatorEvaluation {
  const scope: Scope = new Map();
  for (const input of config.entradas) {
    scope.set(
      input.clave,
      inputValue(input, Object.hasOwn(values, input.clave) ? values[input.clave] : undefined),
    );
  }
  for (const constant of config.constantes) {
    scope.set(constant.clave, constant.valor);
  }
  const calculos: Record<string, SimulatorValue> = {};
  for (const calculation of config.calculos) {
    const value = evaluateNode(calculation.expresion, scope);
    scope.set(calculation.clave, value);
    calculos[calculation.clave] = value;
  }
  return {
    calculos,
    resultados: config.resultados.map((result) => ({
      ...result,
      valor: scope.get(result.clave) ?? null,
    })),
    notas: config.notas
      .filter((note) => note.cuando === undefined || (scope.get(note.cuando) ?? 0) !== 0)
      .map((note) => note.texto),
  };
}
