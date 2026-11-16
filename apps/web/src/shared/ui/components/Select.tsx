import type { SelectHTMLAttributes } from 'react';

import { cx } from './cx';
import { Field, type FieldProps } from './Field';
import control from './control.module.css';

export interface SelectOption {
  value: string;
  label: string;
  /** Grupo (`optgroup`) al que pertenece; las opciones sin grupo van al principio. */
  group?: string;
}

export interface SelectProps
  extends
    Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'required' | 'children'>,
    Pick<FieldProps, 'label' | 'help' | 'error' | 'required' | 'inline'> {
  options: SelectOption[];
  /** Opción inicial sin valor (p. ej. «Selecciona un grado»). */
  placeholder?: string;
}

function groupsOf(options: SelectOption[]): [string, SelectOption[]][] {
  const groups = new Map<string, SelectOption[]>();
  for (const option of options) {
    if (option.group !== undefined) {
      groups.set(option.group, [...(groups.get(option.group) ?? []), option]);
    }
  }
  return [...groups];
}

export function Select({
  label,
  help,
  error,
  required,
  inline,
  options,
  placeholder,
  className,
  ...rest
}: SelectProps) {
  return (
    <Field label={label} help={help} error={error} required={required} inline={inline}>
      {(fieldProps) => (
        <select
          {...rest}
          {...fieldProps}
          className={cx(control.control, control.select, className)}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options
            .filter((option) => option.group === undefined)
            .map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          {groupsOf(options).map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
    </Field>
  );
}
