import { SIMULATOR_LIMITS, simulatorConfigSchema, type SimulatorExpression } from '@gns/shared';

import { DEMO_ACTIVITIES } from './demo-activities.fixture';
import {
  addTerm,
  canAddTerm,
  canRemoveTerm,
  changeKind,
  formulaText,
  fromExprNode,
  measure,
  nodeKind,
  numberNode,
  refNode,
  removeTerm,
  renameRefs,
  toExprNode,
  updateAt,
  withinLimits,
  type ExprNode,
} from './expression-tree';

const sum: ExprNode = changeKind(numberNode(), 'suma');

describe('toExprNode / fromExprNode', () => {
  it('round-trips every expression of the demo simulators', () => {
    let count = 0;
    for (const demo of DEMO_ACTIVITIES.filter((item) => item.type === 'simulador')) {
      const config = simulatorConfigSchema.parse(demo.config);
      for (const calculation of config.calculos) {
        const node = toExprNode(calculation.expresion);
        expect(fromExprNode(node)).toEqual(calculation.expresion);
        count += 1;
      }
    }
    expect(count).toBeGreaterThan(5);
  });

  it('round-trips every kind of node', () => {
    const expressions: SimulatorExpression[] = [
      3.5,
      { ref: 'a' },
      { op: 'redondea', decimales: 2, args: [{ ref: 'a' }] },
      { op: 'compara', comparacion: 'menor_igual', args: [1, { ref: 'b' }] },
      { op: 'si', args: [{ op: 'no', args: [{ ref: 'x' }] }, 1, 2] },
      {
        tramos: {
          clave: 'edad',
          hasta: [
            { hasta: 10, valor: 1 },
            { hasta: 20, valor: { ref: 'c' } },
          ],
          resto: 0,
        },
      },
    ];
    for (const expression of expressions) {
      expect(fromExprNode(toExprNode(expression))).toEqual(expression);
    }
  });

  it('sends a literal that is not a number as NaN for the schema to reject', () => {
    expect(fromExprNode(numberNode('abc'))).toBeNaN();
    expect(fromExprNode(numberNode(' 1,5 '))).toBe(1.5);
  });
});

describe('changeKind', () => {
  it('fills with zero when the new kind needs more terms', () => {
    const node = changeKind(numberNode('5'), 'suma');
    expect(nodeKind(node)).toBe('suma');
    expect(node.args.map((arg) => arg.text)).toEqual(['0', '0']);
    expect(changeKind(node, 'si').args).toHaveLength(3);
  });

  it('keeps the first compatible terms and drops the rest', () => {
    const three = { ...sum, args: [numberNode('1'), numberNode('2'), numberNode('3')] };
    const piso = changeKind(three, 'piso');
    expect(piso.args.map((arg) => arg.text)).toEqual(['1']);
    const divide = changeKind(three, 'divide');
    expect(divide.args.map((arg) => arg.text)).toEqual(['1', '2']);
    expect(changeKind(three, 'multiplica').args).toHaveLength(3);
  });

  it('turns terms into steps when changing to tramos', () => {
    const tramos = changeKind(sum, 'tramos');
    expect(tramos.limits).toHaveLength(1);
    expect(tramos.args).toHaveLength(2);
    expect(changeKind(tramos, 'resta').limits).toEqual([]);
  });
});

describe('terms and limits', () => {
  it('adds and removes terms within the limits of each kind', () => {
    expect(canAddTerm(changeKind(numberNode(), 'resta'))).toBe(false);
    expect(canRemoveTerm(sum)).toBe(false);
    let node = sum;
    while (canAddTerm(node)) {
      node = addTerm(node);
    }
    expect(node.args).toHaveLength(8);
    expect(removeTerm(node, 3).args).toHaveLength(7);
    expect(removeTerm(sum, 0)).toBe(sum);
    expect(canRemoveTerm(changeKind(numberNode(), 'todos'))).toBe(false);
  });

  it('adds a step before the rest in tramos and keeps at least one', () => {
    const tramos = changeKind(sum, 'tramos');
    const added = addTerm(tramos);
    expect(added.limits).toHaveLength(2);
    expect(added.args).toHaveLength(3);
    expect(canRemoveTerm(tramos)).toBe(false);
    expect(removeTerm(added, 0).limits).toHaveLength(1);
  });

  it('measures nodes and depth with the limits of the API', () => {
    const nested = updateAt(sum, [0], () => changeKind(numberNode(), 'suma'));
    expect(measure(nested)).toEqual({ nodes: 5, depth: 3 });
    expect(withinLimits(nested)).toBe(true);
    let deep: ExprNode = numberNode();
    for (let level = 0; level < SIMULATOR_LIMITS.maxDepth; level += 1) {
      deep = { ...changeKind(numberNode(), 'piso'), args: [deep] };
    }
    expect(withinLimits(deep)).toBe(false);
  });
});

describe('updateAt', () => {
  it('replaces the node at the path without touching the rest', () => {
    const root = { ...sum, args: [numberNode('1'), changeKind(numberNode(), 'resta')] };
    const next = updateAt(root, [1, 0], () => refNode('x'));
    expect(next.args[0]).toBe(root.args[0]);
    expect(next.args[1]?.args[0]).toMatchObject({ kind: 'ref', ref: 'x' });
    expect(root.args[1]?.args[0]).toMatchObject({ kind: 'num' });
  });
});

describe('renameRefs', () => {
  it('renames references and the evaluated key of tramos, only the matching ones', () => {
    const tramos = { ...changeKind(numberNode(), 'tramos'), ref: 'edad' };
    const root = { ...sum, args: [refNode('edad'), tramos] };
    const next = renameRefs(root, 'edad', 'anios');
    expect(next.args[0]?.ref).toBe('anios');
    expect(next.args[1]?.ref).toBe('anios');
    expect(renameRefs(root, 'otra', 'x').args[0]?.ref).toBe('edad');
  });
});

describe('formulaText', () => {
  it('writes a readable one-line formula', () => {
    const divide = {
      ...changeKind(numberNode(), 'divide'),
      args: [refNode('pc'), numberNode('100')],
    };
    const root = { ...changeKind(numberNode(), 'multiplica'), args: [refNode('salario'), divide] };
    expect(formulaText(root)).toBe('multiplica(salario, divide(pc, 100))');
    expect(formulaText(refNode())).toBe('…');
    expect(formulaText(numberNode(''))).toBe('…');
  });
});
