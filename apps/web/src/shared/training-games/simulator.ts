import {
  evaluateSimulator,
  type SimulatorConfig,
  type SimulatorEvaluation,
  type SimulatorInput,
  type SimulatorResultFormat,
  type SimulatorValue,
} from '@gns/shared';

/** Texto de un resultado que no se puede calcular con los datos escritos. */
export const NOT_CALCULABLE = '—';

/** Valores escritos en las entradas de un bloque, por `clave:tipo`; solo viven en memoria. */
export type SharedValues = Readonly<Record<string, number>>;

/** Dos entradas comparten valor si tienen la misma clave y el mismo tipo (p. ej. «Salario mensual»). */
export function sharedKey(input: Pick<SimulatorInput, 'clave' | 'tipo'>): string {
  return `${input.clave}:${input.tipo}`;
}

const MAX_MONEY_DIGITS = 13;

/** Importe escrito: solo dígitos (se ignoran puntos, espacios y símbolos); vacío es «sin valor». */
export function parseMoneyInput(text: string): number | null {
  const digits = text.replace(/\D/g, '').slice(0, MAX_MONEY_DIGITS);
  return digits === '' ? null : Number(digits);
}

const MONEY = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/** Importe con puntos de miles, sin símbolo ni decimales («1.250.000»). */
export function formatMoneyInput(value: number): string {
  return MONEY.format(value);
}

/** Resultado para mostrar: pesos colombianos sin decimales, porcentaje, número o «Sí/No». */
export function formatSimulatorValue(value: SimulatorValue, format: SimulatorResultFormat): string {
  if (value === null) {
    return NOT_CALCULABLE;
  }
  switch (format) {
    case 'moneda':
      return `$${MONEY.format(Math.round(value))}`;
    case 'porcentaje':
      return `${DECIMAL.format(value)}%`;
    case 'numero':
      return DECIMAL.format(value);
    case 'si_no':
      return value !== 0 ? 'Sí' : 'No';
  }
}

function inRange(input: SimulatorInput, value: number): boolean {
  switch (input.tipo) {
    case 'opcion':
      return input.opciones.some((option) => option.valor === value);
    case 'moneda':
      return value >= input.min && (input.max === undefined || value <= input.max);
    default:
      return value >= input.min && value <= input.max;
  }
}

/**
 * Valor que se muestra y se calcula en una entrada: el escrito (también en otro simulador del
 * bloque con la misma clave y tipo) si cabe en su rango o es una de sus opciones, y si no, su
 * valor inicial. Un importe sin valor inicial y sin escribir queda sin valor.
 */
export function inputValueOf(input: SimulatorInput, shared: SharedValues): number | undefined {
  const written = shared[sharedKey(input)];
  if (written !== undefined && inRange(input, written)) {
    return written;
  }
  return input.inicial;
}

/** Valores por clave de entrada para `evaluateSimulator`; sin valor, la entrada queda ausente. */
export function valuesForConfig(
  config: SimulatorConfig,
  shared: SharedValues,
): Record<string, number> {
  const values: Record<string, number> = {};
  for (const input of config.entradas) {
    const value = inputValueOf(input, shared);
    if (value !== undefined) {
      values[input.clave] = value;
    }
  }
  return values;
}

/** Resultados, destacado y notas de un simulador con los valores actuales (el cálculo es de `@gns/shared`). */
export function evaluateWith(config: SimulatorConfig, shared: SharedValues): SimulatorEvaluation {
  return evaluateSimulator(config, valuesForConfig(config, shared));
}

/** Valor de una entrada de rango con su unidad, para mostrarlo y para `aria-valuetext`. */
export function formatInputValue(input: SimulatorInput, value: number): string {
  if (input.tipo === 'porcentaje') {
    return `${DECIMAL.format(value)}%`;
  }
  const unit = input.tipo === 'opcion' || input.unidad === undefined ? '' : ` ${input.unidad}`;
  return `${DECIMAL.format(value)}${unit}`;
}
