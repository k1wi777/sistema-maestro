import type { SelectHTMLAttributes } from 'react';

import { cx } from './cx';
import { Field, type FieldProps } from './Field';
import control from './control.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends
    Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'required' | 'children'>,
    Pick<FieldProps, 'label' | 'help' | 'error' | 'required' | 'inline'> {
  options: SelectOption[];
  /** Opción inicial sin valor (p. ej. «Selecciona un grado»). */
  placeholder?: string;
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
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
