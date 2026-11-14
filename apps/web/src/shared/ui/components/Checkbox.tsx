import { useId, type InputHTMLAttributes } from 'react';

import { Icon } from '../icons/Icon';
import { cx } from './cx';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type' | 'children'
> {
  label: string;
  help?: string;
  error?: string;
}

export function Checkbox({ label, help, error, className, ...rest }: CheckboxProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx(styles.wrapper, className)}>
      <div className={styles.row}>
        <input
          {...rest}
          id={id}
          type="checkbox"
          className={styles.box}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        />
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      </div>
      {help ? (
        <p id={helpId} className={styles.help}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={styles.error}>
          <Icon name="error" size={16} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
