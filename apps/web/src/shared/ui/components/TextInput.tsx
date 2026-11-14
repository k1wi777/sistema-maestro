import type { InputHTMLAttributes } from 'react';

import { cx } from './cx';
import { Field, type FieldProps } from './Field';
import control from './control.module.css';

export interface TextInputProps
  extends
    Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'required'>,
    Pick<FieldProps, 'label' | 'help' | 'error' | 'required' | 'inline'> {}

export function TextInput({
  label,
  help,
  error,
  required,
  inline,
  className,
  type = 'text',
  ...rest
}: TextInputProps) {
  return (
    <Field label={label} help={help} error={error} required={required} inline={inline}>
      {(fieldProps) => (
        <input {...rest} {...fieldProps} type={type} className={cx(control.control, className)} />
      )}
    </Field>
  );
}
