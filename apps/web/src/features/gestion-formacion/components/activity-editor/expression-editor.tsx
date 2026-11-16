'use client';

import { SIMULATOR_LIMITS, type SimulatorComparison } from '@gns/shared';

import { Button, Select, TextInput, type SelectOption } from '@/shared/ui';

import {
  addTerm,
  canAddTerm,
  canRemoveTerm,
  changeKind,
  COMPARISON_LABEL,
  EXPRESSION_KINDS,
  formulaText,
  KIND_INFO,
  measure,
  removeTerm,
  type ExpressionKind,
  type ExprNode,
} from '../../model/expression-tree';
import type { AvailableKeys } from '../../model/simulator-form';
import styles from './activity-editor.module.css';
import { replaceItem } from './list-controls';

const COMPARISONS = Object.keys(COMPARISON_LABEL) as SimulatorComparison[];

/** Rótulos de los términos de las operaciones de dos o tres términos. */
const TERM_LABELS: Partial<Record<ExpressionKind, string[]>> = {
  resta: ['Valor del que se resta', 'Valor que se resta'],
  divide: ['Dividendo', 'Divisor'],
  si: ['Si (condición)', 'Entonces', 'Si no'],
  compara: ['Primer valor', 'Segundo valor'],
};

function refOptions(keys: AvailableKeys): SelectOption[] {
  return [
    ...keys.inputs.map((key) => ({ value: key, label: key, group: 'Entradas' })),
    ...keys.constants.map((key) => ({ value: key, label: key, group: 'Constantes' })),
    ...keys.previous.map((key) => ({ value: key, label: key, group: 'Cálculos anteriores' })),
  ];
}

interface EditorProps {
  node: ExprNode;
  /** Nombre del valor para lectores de pantalla: «Cálculo 2 · término 1». */
  name: string;
  keys: AvailableKeys;
  /** Nodos del árbol completo, para respetar el tope de la API. */
  root: ExprNode;
  level: number;
  disabled: boolean;
  onChange: (node: ExprNode) => void;
  errors?: Record<string, string>;
}

/**
 * Editor recursivo de una expresión: un valor es un número, una referencia (solo entradas,
 * constantes y cálculos anteriores), una operación del catálogo o tramos. Nunca se escribe código.
 */
export function ExpressionEditor({
  node,
  name,
  keys,
  root,
  level,
  disabled,
  onChange,
}: EditorProps) {
  const { nodes } = measure(root);
  const atDepth = level >= SIMULATOR_LIMITS.maxDepth;
  const kinds = EXPRESSION_KINDS.filter((kind) => !atDepth || KIND_INFO[kind].max === 0);
  const kindOptions: SelectOption[] = kinds.map((kind) => ({
    value: kind,
    label: KIND_INFO[kind].label,
  }));
  const options = refOptions(keys);
  const roomForTerm = nodes < SIMULATOR_LIMITS.maxNodes && !atDepth;
  const setArg = (index: number, next: ExprNode) =>
    onChange({ ...node, args: replaceItem(node.args, index, next) });

  const child = (index: number, label: string) => {
    const arg = node.args[index];
    return arg ? (
      <ExpressionEditor
        key={index}
        node={arg}
        name={`${name} · ${label.toLowerCase()}`}
        keys={keys}
        root={root}
        level={level + 1}
        disabled={disabled}
        onChange={(next) => setArg(index, next)}
      />
    ) : null;
  };

  const fixedLabels = TERM_LABELS[node.kind];
  const nary = node.kind !== 'tramos' && KIND_INFO[node.kind].max > KIND_INFO[node.kind].min;

  return (
    <div className={`${styles.node} ${level > 1 ? styles.nested : ''}`}>
      <Select
        label={`Tipo de valor (${name})`}
        value={node.kind}
        options={kindOptions}
        disabled={disabled}
        onChange={(event) => onChange(changeKind(node, event.target.value as ExpressionKind))}
      />

      {node.kind === 'num' ? (
        <TextInput
          label={`Número (${name})`}
          inputMode="decimal"
          value={node.text}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => onChange({ ...node, text: event.target.value })}
        />
      ) : null}

      {node.kind === 'ref' ? (
        <Select
          label={`Valor de (${name})`}
          value={node.ref}
          placeholder="Elige un valor"
          options={options}
          disabled={disabled}
          onChange={(event) => onChange({ ...node, ref: event.target.value })}
        />
      ) : null}

      {node.kind === 'redondea' ? (
        <TextInput
          label={`Decimales (${name})`}
          inputMode="numeric"
          value={node.decimals}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => onChange({ ...node, decimals: event.target.value })}
        />
      ) : null}

      {node.kind === 'compara' ? (
        <>
          {child(0, 'Primer valor')}
          <Select
            label={`Comparación (${name})`}
            value={node.comparison}
            options={COMPARISONS.map((value) => ({ value, label: COMPARISON_LABEL[value] }))}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...node, comparison: event.target.value as SimulatorComparison })
            }
          />
          {child(1, 'Segundo valor')}
        </>
      ) : null}

      {fixedLabels && node.kind !== 'compara'
        ? node.args.map((_, index) => (
            <div key={index} className={styles.formula}>
              <p className={styles.label}>{fixedLabels[index]}</p>
              {child(index, fixedLabels[index] ?? `término ${index + 1}`)}
            </div>
          ))
        : null}

      {node.kind === 'redondea' || node.kind === 'piso' || node.kind === 'no'
        ? node.args.map((_, index) => child(index, 'término'))
        : null}

      {nary ? (
        <>
          {node.args.map((_, index) => (
            <div key={index} className={styles.formula}>
              <div className={styles.summaryRow}>
                <p className={styles.label}>{`Término ${index + 1}`}</p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled || !canRemoveTerm(node)}
                  onClick={() => onChange(removeTerm(node, index))}
                >
                  Quitar término
                  <span className="sr-only">{` ${index + 1} de ${name}`}</span>
                </Button>
              </div>
              {child(index, `término ${index + 1}`)}
            </div>
          ))}
          <div className={styles.actions}>
            <Button
              variant="outline"
              size="sm"
              startIcon="mas"
              disabled={disabled || !canAddTerm(node) || !roomForTerm}
              onClick={() => onChange(addTerm(node))}
            >
              Agregar término
              <span className="sr-only">{` a ${name}`}</span>
            </Button>
          </div>
        </>
      ) : null}

      {node.kind === 'tramos' ? (
        <>
          <Select
            label={`Valor que se evalúa (${name})`}
            value={node.ref}
            placeholder="Elige un valor"
            options={options}
            disabled={disabled}
            onChange={(event) => onChange({ ...node, ref: event.target.value })}
          />
          {node.limits.map((limit, index) => (
            <div key={index} className={styles.formula}>
              <div className={styles.stepRow}>
                <TextInput
                  label={`Hasta (tramo ${index + 1} de ${name})`}
                  inputMode="decimal"
                  value={limit}
                  disabled={disabled}
                  autoComplete="off"
                  onChange={(event) =>
                    onChange({
                      ...node,
                      limits: replaceItem(node.limits, index, event.target.value),
                    })
                  }
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled || !canRemoveTerm(node)}
                  onClick={() => onChange(removeTerm(node, index))}
                >
                  Quitar tramo
                  <span className="sr-only">{` ${index + 1} de ${name}`}</span>
                </Button>
              </div>
              {child(index, `valor del tramo ${index + 1}`)}
            </div>
          ))}
          <div className={styles.formula}>
            <p className={styles.label}>Resto (si ningún tramo aplica)</p>
            {child(node.args.length - 1, 'resto')}
          </div>
          <div className={styles.actions}>
            <Button
              variant="outline"
              size="sm"
              startIcon="mas"
              disabled={disabled || !canAddTerm(node) || !roomForTerm}
              onClick={() => onChange(addTerm(node))}
            >
              Agregar tramo
              <span className="sr-only">{` a ${name}`}</span>
            </Button>
          </div>
        </>
      ) : null}

      {level === 1 ? <p className={styles.formulaText}>{formulaText(node)}</p> : null}
    </div>
  );
}
