'use client';

import { useRef, type KeyboardEvent } from 'react';

import { cx } from './cx';
import styles from './SegmentedFilter.module.css';

export interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
  /** Contador opcional (p. ej. registros por estado). */
  count?: number;
}

interface BaseProps<Value extends string> {
  /** Nombre accesible del grupo. */
  label: string;
  options: SegmentedOption<Value>[];
  className?: string;
}

interface SingleProps<Value extends string> extends BaseProps<Value> {
  multiple?: false;
  value: Value;
  onChange: (value: Value) => void;
}

interface MultipleProps<Value extends string> extends BaseProps<Value> {
  multiple: true;
  values: Value[];
  onChange: (values: Value[]) => void;
}

export type SegmentedFilterProps<Value extends string> = SingleProps<Value> | MultipleProps<Value>;

/**
 * Control segmentado para filtrar. Selección única: `radiogroup` con flechas (la
 * selección sigue al foco). Selección múltiple: botones con `aria-pressed`.
 */
export function SegmentedFilter<Value extends string>(props: SegmentedFilterProps<Value>) {
  const { label, options, className } = props;
  const refs = useRef(new Map<Value, HTMLButtonElement>());

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (props.multiple) return;
    const last = options.length - 1;
    const targets: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowDown: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const target = targets[event.key];
    const next = target === undefined ? undefined : options[target];
    if (next) {
      event.preventDefault();
      props.onChange(next.value);
      refs.current.get(next.value)?.focus();
    }
  }

  return (
    <div
      role={props.multiple ? 'group' : 'radiogroup'}
      aria-label={label}
      className={cx(styles.group, className)}
    >
      {options.map((option, index) => {
        const selected = props.multiple
          ? props.values.includes(option.value)
          : props.value === option.value;
        const roving = props.multiple ? undefined : selected ? 0 : -1;
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) refs.current.set(option.value, node);
              else refs.current.delete(option.value);
            }}
            type="button"
            role={props.multiple ? undefined : 'radio'}
            aria-checked={props.multiple ? undefined : selected}
            aria-pressed={props.multiple ? selected : undefined}
            tabIndex={roving}
            className={cx(styles.option, selected && styles.selected)}
            onClick={() => {
              if (props.multiple) {
                props.onChange(
                  selected
                    ? props.values.filter((value) => value !== option.value)
                    : [...props.values, option.value],
                );
              } else {
                props.onChange(option.value);
              }
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className={styles.count}>
                <span className="sr-only"> (</span>
                {option.count}
                <span className="sr-only">)</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
