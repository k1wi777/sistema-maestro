import { SIMULATOR_LIMITS, type SimulatorComparison, type SimulatorExpression } from '@gns/shared';

import { parseDecimal } from './form-numbers';

/** Tipos de valor de una expresión: número, referencia, las operaciones del catálogo y tramos. */
export const EXPRESSION_KINDS = [
  'num',
  'ref',
  'suma',
  'resta',
  'multiplica',
  'divide',
  'minimo',
  'maximo',
  'piso',
  'redondea',
  'compara',
  'todos',
  'alguno',
  'no',
  'si',
  'tramos',
] as const;
export type ExpressionKind = (typeof EXPRESSION_KINDS)[number];

/**
 * Nodo editable. Todos los nodos tienen la misma forma para poder cambiar de tipo sin perder los
 * términos compatibles: `args` son los términos (en `tramos`, el valor de cada tramo y al final el
 * «resto»), `limits` los «hasta» de los tramos y `ref` la referencia (en `tramos`, la clave que se
 * evalúa). Los números van como texto hasta validar.
 */
export interface ExprNode {
  kind: ExpressionKind;
  text: string;
  ref: string;
  args: ExprNode[];
  decimals: string;
  comparison: SimulatorComparison;
  limits: string[];
}

interface KindInfo {
  label: string;
  /** Cantidad de términos; en `tramos`, de valores (límites + resto). */
  min: number;
  max: number;
}

const TERM_MAX = 8;
const STEPS_MAX = 10;

export const KIND_INFO: Record<ExpressionKind, KindInfo> = {
  num: { label: 'Número', min: 0, max: 0 },
  ref: { label: 'Valor de…', min: 0, max: 0 },
  suma: { label: 'Suma', min: 2, max: TERM_MAX },
  resta: { label: 'Resta', min: 2, max: 2 },
  multiplica: { label: 'Multiplica', min: 2, max: TERM_MAX },
  divide: { label: 'Divide', min: 2, max: 2 },
  minimo: { label: 'Mínimo', min: 2, max: TERM_MAX },
  maximo: { label: 'Máximo', min: 2, max: TERM_MAX },
  piso: { label: 'Piso (hacia abajo)', min: 1, max: 1 },
  redondea: { label: 'Redondea', min: 1, max: 1 },
  compara: { label: 'Compara', min: 2, max: 2 },
  todos: { label: 'Todos (y)', min: 1, max: TERM_MAX },
  alguno: { label: 'Alguno (o)', min: 1, max: TERM_MAX },
  no: { label: 'No', min: 1, max: 1 },
  si: { label: 'Si … entonces … si no', min: 3, max: 3 },
  tramos: { label: 'Tramos', min: 2, max: STEPS_MAX + 1 },
};

export const COMPARISON_LABEL: Record<SimulatorComparison, string> = {
  mayor: 'es mayor que',
  mayor_igual: 'es mayor o igual que',
  menor: 'es menor que',
  menor_igual: 'es menor o igual que',
  igual: 'es igual a',
};

export function numberNode(text = '0'): ExprNode {
  return {
    kind: 'num',
    text,
    ref: '',
    args: [],
    decimals: '0',
    comparison: 'mayor',
    limits: [],
  };
}

export function refNode(ref = ''): ExprNode {
  return { ...numberNode(), kind: 'ref', ref };
}

/** Tipo del nodo, para el selector «Tipo de valor». */
export function nodeKind(node: ExprNode): ExpressionKind {
  return node.kind;
}

/** Cantidad de términos con la que nace un nodo de ese tipo. */
function startingTerms(kind: ExpressionKind): number {
  return KIND_INFO[kind].min;
}

/**
 * Cambia el tipo de valor conservando los términos compatibles (los primeros) y rellenando con el
 * número 0 los que falten; los que sobran se descartan.
 */
export function changeKind(node: ExprNode, kind: ExpressionKind): ExprNode {
  if (kind === node.kind) {
    return node;
  }
  const info = KIND_INFO[kind];
  const wanted = Math.min(Math.max(node.args.length, startingTerms(kind)), info.max);
  const args = Array.from({ length: wanted }, (_, index) => node.args[index] ?? numberNode());
  return {
    ...node,
    kind,
    args,
    limits: kind === 'tramos' ? Array.from({ length: args.length - 1 }, () => '') : [],
  };
}

/** Sustituye el nodo en `path` (posiciones dentro de `args`) con lo que devuelve `change`. */
export function updateAt(
  root: ExprNode,
  path: readonly number[],
  change: (node: ExprNode) => ExprNode,
): ExprNode {
  const [head, ...rest] = path;
  if (head === undefined) {
    return change(root);
  }
  return {
    ...root,
    args: root.args.map((child, index) => (index === head ? updateAt(child, rest, change) : child)),
  };
}

export function canAddTerm(node: ExprNode): boolean {
  if (node.kind === 'tramos') {
    return node.limits.length < STEPS_MAX;
  }
  return (
    KIND_INFO[node.kind].max > KIND_INFO[node.kind].min &&
    node.args.length < KIND_INFO[node.kind].max
  );
}

export function canRemoveTerm(node: ExprNode): boolean {
  if (node.kind === 'tramos') {
    return node.limits.length > 1;
  }
  const info = KIND_INFO[node.kind];
  return info.max > info.min && node.args.length > info.min;
}

/** Agrega un término (en `tramos`, un tramo antes del «resto»). */
export function addTerm(node: ExprNode): ExprNode {
  if (!canAddTerm(node)) {
    return node;
  }
  if (node.kind === 'tramos') {
    const rest = node.args[node.args.length - 1];
    const steps = node.args.slice(0, -1);
    return {
      ...node,
      limits: [...node.limits, ''],
      args: [...steps, numberNode(), ...(rest ? [rest] : [])],
    };
  }
  return { ...node, args: [...node.args, numberNode()] };
}

/** Quita el término `index` (en `tramos`, el tramo `index`; el «resto» no se quita). */
export function removeTerm(node: ExprNode, index: number): ExprNode {
  if (!canRemoveTerm(node)) {
    return node;
  }
  if (node.kind === 'tramos') {
    return {
      ...node,
      limits: node.limits.filter((_, position) => position !== index),
      args: node.args.filter((_, position) => position !== index),
    };
  }
  return { ...node, args: node.args.filter((_, position) => position !== index) };
}

/** Cambia el nombre de una clave en todas las referencias del árbol (valores y tramos). */
export function renameRefs(node: ExprNode, from: string, to: string): ExprNode {
  const usesRef = node.kind === 'ref' || node.kind === 'tramos';
  return {
    ...node,
    ref: usesRef && node.ref === from ? to : node.ref,
    args: node.args.map((child) => renameRefs(child, from, to)),
  };
}

/** Nodos y profundidad del árbol, para respetar los límites de la API. */
export function measure(root: ExprNode): { nodes: number; depth: number } {
  let nodes = 0;
  let depth = 0;
  const visit = (node: ExprNode, level: number) => {
    nodes += 1;
    depth = Math.max(depth, level);
    node.args.forEach((child) => visit(child, level + 1));
  };
  visit(root, 1);
  return { nodes, depth };
}

/** ¿Cabe un nodo más dentro de `node` (que está a `level` de profundidad) según la API? */
export function canNestMore(root: ExprNode, extraNodes: number): boolean {
  const { nodes, depth } = measure(root);
  return nodes + extraNodes <= SIMULATOR_LIMITS.maxNodes && depth < SIMULATOR_LIMITS.maxDepth;
}

export function withinLimits(root: ExprNode): boolean {
  const { nodes, depth } = measure(root);
  return nodes <= SIMULATOR_LIMITS.maxNodes && depth <= SIMULATOR_LIMITS.maxDepth;
}

/** Texto legible de una línea, p. ej. «multiplica(salario, divide(pc, 100))». */
export function formulaText(node: ExprNode): string {
  const term = (child: ExprNode) => formulaText(child);
  switch (node.kind) {
    case 'num':
      return node.text.trim() === '' ? '…' : node.text.trim();
    case 'ref':
      return node.ref === '' ? '…' : node.ref;
    case 'compara':
      return `compara ${node.comparison}(${node.args.map(term).join(', ')})`;
    case 'redondea':
      return `redondea(${node.args.map(term).join(', ')}; ${node.decimals} decimales)`;
    case 'tramos': {
      const steps = node.limits.map(
        (limit, index) =>
          `hasta ${limit.trim() === '' ? '…' : limit.trim()} → ${node.args[index] ? term(node.args[index]) : '…'}`,
      );
      const rest = node.args[node.args.length - 1];
      return `tramos de ${node.ref === '' ? '…' : node.ref}(${[...steps, `resto → ${rest ? term(rest) : '…'}`].join('; ')})`;
    }
    default:
      return `${node.kind}(${node.args.map(term).join(', ')})`;
  }
}

/** Nodo editable a partir de la expresión guardada. */
export function toExprNode(expression: SimulatorExpression): ExprNode {
  if (typeof expression === 'number') {
    return numberNode(String(expression));
  }
  if ('ref' in expression) {
    return refNode(expression.ref);
  }
  if ('tramos' in expression) {
    const { clave, hasta, resto } = expression.tramos;
    return {
      ...numberNode(),
      kind: 'tramos',
      ref: clave,
      limits: hasta.map((step) => String(step.hasta)),
      args: [...hasta.map((step) => toExprNode(step.valor)), toExprNode(resto)],
    };
  }
  const base: ExprNode = {
    ...numberNode(),
    kind: expression.op,
    args: expression.args.map(toExprNode),
  };
  if (expression.op === 'redondea') {
    base.decimals = String(expression.decimales);
  }
  if (expression.op === 'compara') {
    base.comparison = expression.comparacion;
  }
  return base;
}

/** Candidato para el esquema compartido a partir del nodo editable. */
export function fromExprNode(node: ExprNode): unknown {
  const args = node.args.map(fromExprNode);
  switch (node.kind) {
    case 'num':
      return parseDecimal(node.text) ?? Number.NaN;
    case 'ref':
      return { ref: node.ref };
    case 'redondea':
      return { op: 'redondea', decimales: parseDecimal(node.decimals) ?? Number.NaN, args };
    case 'compara':
      return { op: 'compara', comparacion: node.comparison, args };
    case 'tramos':
      return {
        tramos: {
          clave: node.ref,
          hasta: node.limits.map((limit, index) => ({
            hasta: parseDecimal(limit) ?? Number.NaN,
            valor: args[index],
          })),
          resto: args[args.length - 1],
        },
      };
    default:
      return { op: node.kind, args };
  }
}
