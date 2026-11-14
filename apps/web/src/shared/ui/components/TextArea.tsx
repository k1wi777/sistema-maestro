import type { TextareaHTMLAttributes } from 'react';

import { cx } from './cx';
import { Field, type FieldProps } from './Field';
import control from './control.module.css';

export interface TextAreaProps
  extends
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'required'>,
    Pick<FieldProps, 'label' | 'help' | 'error' | 'required'> {}

export function TextArea({ label, help, error, required, className, ...rest }: TextAreaProps) {
  return (
    <Field label={label} help={help} error={error} required={required}>
      {(fieldProps) => (
        <textarea
          {...rest}
          {...fieldProps}
          className={cx(control.control, control.textarea, className)}
        />
      )}
    </Field>
  );
}
