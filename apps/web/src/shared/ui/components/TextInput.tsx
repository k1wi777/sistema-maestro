import type { InputHTMLAttributes } from 'react';

import { cx } from './cx';
import { Field, type FieldProps } from './Field';
import control from './control.module.css';

export interface TextInputProps
  extends
    Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'required' | 'size'>,
    Pick<FieldProps, 'label' | 'help' | 'error' | 'required' | 'inline' | 'size'> {}

export function TextInput({
  label,
  help,
  error,
  required,
  inline,
  size,
  className,
  type = 'text',
  ...rest
}: TextInputProps) {
  return (
    <Field label={label} help={help} error={error} required={required} inline={inline} size={size}>
      {(fieldProps) => (
        <input
          {...rest}
          {...fieldProps}
          type={type}
          className={cx(control.control, size === 'sm' && control.small, className)}
        />
      )}
    </Field>
  );
}
